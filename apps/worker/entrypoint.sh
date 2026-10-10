#!/bin/sh
set -e
cd /app
# รองรับทั้ง RQ และ plain loop — ใช้ plain loop เป็น default เพราะเขียน status ตรงไปตรงมา
exec python -m app.worker --loop
