<?php
/* ─────────────────────────────────────────────────────────────
   RMS Integration Config
   ค่าด้านล่างเป็นค่าเริ่มต้น — ผู้ดูแลระบบแก้ไขได้ที่ ตั้งค่า → ระบบ RMS
   (เก็บใน app_settings: rms_url, rms_interval)
───────────────────────────────────────────────────────────── */

defined('RMS_BASE_URL') || define('RMS_BASE_URL', 'https://rms.rvc.ac.th/');
defined('RMS_PEOPLE_PATH') || define('RMS_PEOPLE_PATH', 'api_connection.php?app_name=nutty&data=people');

/* ช่วงเวลาตรวจสอบอัตโนมัติ (วินาที) — ค่าเริ่มต้น 1 ชั่วโมง */
defined('RMS_AUTO_SYNC_INTERVAL') || define('RMS_AUTO_SYNC_INTERVAL', 3600);

function rmsDefaultUrl(): string
{
    return rtrim(RMS_BASE_URL, '/') . '/' . ltrim(RMS_PEOPLE_PATH, '/');
}

/** URL เต็มของ API รายชื่อบุคลากรใน RMS */
function rmsPeopleUrl(PDO $db): string
{
    return getSetting($db, 'rms_url') ?: rmsDefaultUrl();
}

function rmsInterval(PDO $db): int
{
    $v = (int)getSetting($db, 'rms_interval', '0');
    return $v > 0 ? $v : RMS_AUTO_SYNC_INTERVAL;
}
