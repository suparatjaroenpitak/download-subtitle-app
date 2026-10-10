"""YouTube Transcript Provider — module แยกเพื่อเปลี่ยนวิธีเชื่อมต่อในอนาคต.

หลักการ:
- ใช้ yt-dlp (safe mode, ไม่บายพาส CAPTCHA/member-only)
- แสดงรายการภาษาคำบรรยายที่ "เจ้าของวิดีโอจัดทำ" + "auto-generated" ที่เข้าถึงได้
- คืน segments พร้อม timestamp จริงจาก youtube cc format
- ถ้าไม่มีคำบรรยาย → NoCaptionsError; ถ้า youtube block → BlockedError

ห้ามใช้ endpoint ภายใน/แฮ็ก/บายพาสข้อจำกัดของ YouTube.
"""
from __future__ import annotations

import json
import re
from typing import Any


class ProviderError(Exception):
    pass


class NoCaptionsError(ProviderError):
    """วิดีโอไม่มีคำบรรยายที่เข้าถึงได้."""
    pass


class BlockedError(ProviderError):
    """YouTube จำกัดการเข้าถึง (CAPTCHA, member-only, อายุ และอื่น ๆ)."""
    pass


class InvalidLanguageError(ProviderError):
    pass


_VIDEO_ID_RE = re.compile(
    r"(?:v=|/shorts/|/embed/|\.be/)([A-Za-z0-9_-]{11})"
)


def extract_video_id(url: str) -> str:
    m = _VIDEO_ID_RE.search(url)
    if not m:
        raise ProviderError("ไม่พบ video id จาก URL")
    return m.group(1)


def _dict_to_srt_dict(info: dict[str, Any]) -> dict[str, Any] | None:
    """รองรับคำบรรยายกลุ่ม manual / auto ที่ต่างรูปแบบกัน."""
    cc = info.get("subtitles") or info.get("automatic_captions") or {}
    return cc or None


def _caption_entry_language(cc: dict[str, Any], code: str) -> tuple[str, Any] | None:
    """คืน (actual_code, entry) โดยเช็ค code ตรง ๆ ก่อน, แล้ว suffix ญาติเช่น 'th-TH'."""
    if code in cc:
        return code, cc[code]
    base = code.split("-")[0]
    for k in cc:
        if k.split("-")[0] == base:
            return k, cc[k]
    return None


def _parse_vtt_or_srv3(content: str) -> list[dict[str, Any]]:
    """แปลง VTT / SRV3 (youtube paid captions) เป็น segments."""
    out: list[dict[str, Any]] = []
    if content.lstrip().startswith("WEBVTT"):
        blocks = re.split(r"\n\n+", content.strip())
        for b in blocks:
            lines = [l for l in b.splitlines() if l.strip()]
            if not lines:
                continue
            ts = None
            text_lines = []
            for l in lines:
                m = re.search(r"(\d[\d:.]+) --> (\d[\d:.]+)", l)
                if m:
                    ts = (m.group(1), m.group(2))
                elif not l.strip().isdigit() and not l.startswith(("WEBVTT", "Kind:", "Language:", "NOTE")):
                    # vtt บางทั้งมี markup เช่น <c>...</c>
                    text_lines.append(re.sub(r"<[^>]+>", "", l).strip())
            if ts and text_lines:
                out.append({"start": _ts_to_sec(ts[0]), "end": _ts_to_sec(ts[1]), "text": " ".join(text_lines)})
        return out
    # json3 / srv3
    try:
        data = json.loads(content)
    except Exception:
        return out
    events = data.get("events") or []
    for ev in events:
        segs = ev.get("segs") or []
        text = "".join(s.get("utf8", "") for s in segs).strip()
        if not text:
            continue
        start = int(ev.get("tStartMs", 0)) / 1000.0
        dur = int(ev.get("dDurationMs", 0)) / 1000.0
        out.append({"start": start, "end": start + dur, "text": text})
    return out


def _ts_to_sec(ts: str) -> float:
    parts = ts.replace(",", ".").split(":")
    try:
        if len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        if len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        return float(parts[0])
    except Exception:
        return 0.0


# ---------------- public API ----------------
def info(url: str) -> dict[str, Any]:
    """รายการภาษาคำบรรยายที่เข้าถึงได้ (manual + auto)."""
    try:
        import yt_dlp
    except ImportError as e:
        raise ProviderError("yt-dlp ยังไม่ติดตั้ง (run `pip install -r apps/worker/requirements.txt`)") from e

    video_id = extract_video_id(url)
    opts = {
        "quiet": True,
        "noplaylist": True,
        "skip_download": True,
        "no_warnings": True,
        # ไม่บายพาส: ไม่ใส่ cookie/proxy แปลก ๆ
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            data = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        msg = str(e)
        if any(k in msg.lower() for k in ("captcha", "sign in", "members-only", "private", "age")):
            raise BlockedError("YouTube จำกัดการเข้าถึงวิดีโอนี้ ไม่สามารถดึงคำบรรยายได้โดยสวัสดิภาพ") from e
        if "not available" in msg.lower() or "removed" in msg.lower():
            raise NoCaptionsError("ไม่พบวิดีโอ หรือวิดีโอถูกลบ") from e
        raise ProviderError(f"ดึงข้อมูลวิดีโอไม่สำเร็จ: {msg[:200]}") from e

    if not data:
        raise NoCaptionsError("ไม่พบข้อมูลวิดีโอ")

    manual = data.get("subtitles") or {}
    auto = data.get("automatic_captions") or {}
    langs: list[dict[str, Any]] = []
    for code, entry in sorted(manual.items()):
        # เลือก format เบาที่สุดคือ json3/vtt
        formats = entry if isinstance(entry, list) else []
        if formats:
            langs.append({"code": code, "name": code, "is_auto": False})
    for code in sorted(auto.keys()):
        if code.endswith(("-orig", )) or code in ("live_chat",):
            continue
        langs.append({"code": code, "name": code, "is_auto": True})

    if not langs:
        raise NoCaptionsError("วิดีโอนี้ไม่มีคำบรรยายที่เข้าถึงได้ — ลองอัปโหลดไฟล์เสียงแทน")

    return {
        "video_id": video_id,
        "title": data.get("title"),
        "duration_seconds": data.get("duration"),
        "available_languages": langs,
    }


def transcript(url: str, language_code: str) -> dict[str, Any]:
    """ดึงคำบรรยายตามภาษา — คืน segments + text."""
    try:
        import yt_dlp
    except ImportError as e:
        raise ProviderError("yt-dlp ยังไม่ติดตั้ง") from e

    opts = {"quiet": True, "noplaylist": True, "skip_download": True, "no_warnings": True}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            data = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        raise BlockedError(f"YouTube จำกัดการเข้าถึง: {str(e)[:200]}") from e
    if not data:
        raise NoCaptionsError("ไม่พบข้อมูลวิดีโอ")

    cc = _dict_to_srt_dict(data)
    if not cc:
        raise NoCaptionsError("วิดีโอนี้ไม่มีคำบรรยาย")

    pick = _caption_entry_language(cc, language_code)
    if not pick:
        raise InvalidLanguageError(f"ไม่มีคำบรรยายภาษา '{language_code}' ในวิดีโอนี้")
    actual_code, entries = pick
    is_auto = actual_code in (data.get("automatic_captions") or {})

    # เลือก format json3/vtt เบา ๆ
    fmt_url = None
    for f in entries:
        if f.get("ext") == "json3":
            fmt_url = f.get("url")
            break
    if not fmt_url:
        for f in entries:
            if f.get("ext") in ("vtt", "srv1", "srv3"):
                fmt_url = f.get("url")
                break
    if not fmt_url:
        raise NoCaptionsError("รูปแบบคำบรรยายไม่รองรับ")

    import urllib.request
    try:
        req = urllib.request.Request(fmt_url, headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        raise ProviderError(f"ดาวน์โหลดคำบรรยายไม่สำเร็จ: {e}") from e

    segments = _parse_vtt_or_srv3(content)
    if not segments:
        raise NoCaptionsError("ไม่สามารถแปลงคำบรรยายได้")

    full_text = " ".join(s["text"] for s in segments)
    return {
        "video_id": data.get("id"),
        "language_code": actual_code,
        "segments": segments,
        "text": full_text,
        "is_auto": is_auto,
    }
