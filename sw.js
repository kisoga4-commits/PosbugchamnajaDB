/**
 * VILLAGE POS - Service Worker V11.2.0 (Stable Offline)
 * ระบบจัดการแคชเน้นทำงานออฟไลน์เป็นหลัก และรองรับการ Sync อัปเดต
 */

const CACHE_NAME = 'vpos-v11-2-0-stable'; // เปลี่ยนเลขตรงนี้ทุกครั้งที่มึงอยากให้ลูกค้ากด "ซิงค์" แล้วได้ของใหม่

// 🟢 1. รายการ "เสบียง" (Assets) ที่ต้องสูบลงเครื่องให้ครบเพื่อรันแบบ Offline
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // --- ไฟล์ภายนอก (CDN) ต้องระบุ URL เต็มเพื่อให้ SW สูบลงแคชได้ ---
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/html5-qrcode',
  'https://unpkg.com/dexie/dist/dexie.js',
  'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;800;900&display=swap'
];

// 🛠️ 1. ตอนติดตั้งแอป (Install) - บังคับโหลด CORE_ASSETS ลงแคชทันที
self.addEventListener('install', event => {
  console.log('📦 SW: Installing Stable Cache...');
  self.skipWaiting(); // บังคับให้ SW ตัวใหม่ทำงานทันที ไม่ต้องรอปิดแอป
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // ใช้ addAll เพื่อสูบไฟล์ที่ระบุไว้ลงเครื่อง
      return cache.addAll(CORE_ASSETS);
    })
  );
});

// 🛠️ 2. ตอนเปิดใช้งาน (Activate) - ล้างแคชเก่าที่หมดอายุ
self.addEventListener('activate', event => {
  console.log('🚀 SW: Cache V11.2.0 Activated');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🗑️ SW: Clearing Old Cache...', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim(); // ควบคุม Browser ทุกหน้าต่างทันที
});

// 🛠️ 3. ตอนดึงข้อมูล (Fetch) - หัวใจของระบบ Offline
self.addEventListener('fetch', event => {
  // ไม่ยุ่งกับคำสั่งที่ไม่ใช่การดึงข้อมูล (GET)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 🛡️ ด่านที่ 1: ถ้ามีไฟล์ในเครื่อง (Cache) ให้ใช้จากเครื่องทันที! (เร็วและ Offline ชัวร์)
      if (cachedResponse) {
        return cachedResponse;
      }

      // 🌐 ด่านที่ 2: ถ้าไม่มีในเครื่อง (เช่น รูปที่เพิ่งโหลด) ให้ไปดึงจากเน็ต
      return fetch(event.request).then(networkResponse => {
        // ตรวจสอบว่า response ปกติไหม (ถ้าไม่ปกติไม่ต้องเก็บแคช)
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // 💾 ด่านที่ 3: โหลดมาแล้ว "จำ" ลงเครื่องอัตโนมัติ (Dynamic Caching)
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // 🆘 ด่านที่ 4: ถ้าเน็ตหลุด + หาไฟล์ไม่เจอ (เช่น เข้าหน้า URL แปลกๆ)
        // ให้ส่งหน้า index.html กลับไปเสมอ เพื่อป้องกันแอปค้างหน้าขาว
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
