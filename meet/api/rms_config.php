<?php
/* ─────────────────────────────────────────────────────────────
   RMS Integration Config
   แก้ไข RMS_BASE_URL เพื่อเปลี่ยน server ต้นทาง
───────────────────────────────────────────────────────────── */

defined('RMS_BASE_URL') || define('RMS_BASE_URL', 'https://rms.rvc.ac.th/');
defined('RMS_PEOPLE_PATH') || define('RMS_PEOPLE_PATH', 'api_connection.php?app_name=nutty&data=people');

/* ช่วงเวลาตรวจสอบอัตโนมัติ (วินาที) — ค่าเริ่มต้น 1 ชั่วโมง */
defined('RMS_AUTO_SYNC_INTERVAL') || define('RMS_AUTO_SYNC_INTERVAL', 3600);
