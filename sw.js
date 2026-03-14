const CACHE_NAME = 'vpos-v11-pro-secure-cache-v2'; // เปลี่ยนเป็น v2 เพื่อล้างของเก่าที่ค้างเอ๋อๆ ทิ้ง

// 🟢 1. ของสำคัญที่บังคับโหลดตั้งแต่ตอนติดตั้ง
const CORE_ASSETS = [
  './',             // สำคัญมาก! บราวเซอร์มักจะมองหา root path
  './index.html',
  './manifest.json',
  // ต้องยัดไฟล์ CDN ทั้งหมดลงแคชด้วย ไม่งั้นออฟไลน์แล้ว Database ไม่ทำงาน
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/html5-qrcode',
  'https://unpkg.com/dexie/dist/dexie.js',
  'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;800;900&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('🔒 Secure Cache V2 Activated');
      return cache.addAll(CORE_ASSETS);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🗑️ Clearing Old Cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 🟢 2. อัปเกรด Fetch: โหมด "จำอัตโนมัติ (Dynamic Caching)"
self.addEventListener('fetch', event => {
  // ไม่ยุ่งกับคำสั่งแบบอื่นนอกจาก GET (เช่น พวก API จ่ายเงิน)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // ด่าน 1: ถ้ามีในเครื่อง เอามาใช้เลย เร็วและกันเน็ตหลุด
      if (cachedResponse) return cachedResponse;
      
      // ด่าน 2: ถ้าไม่มีในเครื่อง ให้วิ่งไปโหลดจากเน็ต
      return fetch(event.request).then(response => {
        // ด่าน 3: โหลดมาแล้ว จับยัดลง Cache ด้วยเลย! ครั้งหน้าจะได้มีใช้
        return caches.open(CACHE_NAME).then(cache => {
          // คัดลอก response ไว้ลงแคช
          cache.put(event.request, response.clone());
          return response;
        });
      }).catch(() => {
        // ด่าน 4: เน็ตหลุด แถมหาไฟล์ไม่เจอ! 
        // ถ้าสิ่งที่พยายามโหลดคือหน้าเว็บ ให้บังคับเด้งกลับไป index.html กันหน้าขาว
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
