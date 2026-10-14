<?php
/* ─────────────────────────────────────────────────────────────
   RVC-ONE (OA) Integration Config — SSO + User-sync API
   ค่าทั้งหมด override ได้ใน db.config.php (gitignored) หรือ env
   ⚠ client_secret ห้าม commit — ตั้งผ่าน env OA_CLIENT_SECRET
     หรือ define('OA_CLIENT_SECRET', '...') ใน api/db.config.php
───────────────────────────────────────────────────────────── */

defined('OA_AUTHORIZE_URL') || define('OA_AUTHORIZE_URL', 'http://workspace.rvc.ac.th/oa/index.php');
defined('OA_VERIFY_URL')    || define('OA_VERIFY_URL',    'http://workspace.rvc.ac.th/oa/api/verify_token.php');
defined('OA_USERS_URL')     || define('OA_USERS_URL',     'http://workspace.rvc.ac.th/oa/api/users.php');
defined('OA_CLIENT_ID')     || define('OA_CLIENT_ID',     'meet');
defined('OA_REDIRECT_URI')  || define('OA_REDIRECT_URI',  'https://meet.rvc.ac.th/web/auth/callback');

defined('OA_CLIENT_SECRET') || define('OA_CLIENT_SECRET', (string)(getenv('OA_CLIENT_SECRET') ?: ''));

/* ประเภทผู้ใช้ที่ซิงค์: staff | student | all — ว่าง = ทุกประเภทที่แอปได้รับอนุญาต */
defined('OA_SYNC_TYPE')     || define('OA_SYNC_TYPE',     (string)(getenv('OA_SYNC_TYPE') ?: ''));
defined('OA_SYNC_LIMIT')    || define('OA_SYNC_LIMIT',    500);

/* timeout (วินาที) และจำนวนครั้งที่ลองใหม่เมื่อเครือข่าย/เซิร์ฟเวอร์ล้ม */
defined('OA_HTTP_TIMEOUT')  || define('OA_HTTP_TIMEOUT',  20);
defined('OA_HTTP_RETRIES')  || define('OA_HTTP_RETRIES',  3);

/* อายุ state ที่เก็บใน session ระหว่างรอ callback (วินาที) */
defined('OA_STATE_TTL')     || define('OA_STATE_TTL',     600);
