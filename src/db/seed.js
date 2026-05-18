require('dotenv').config();
const pool = require('./pool');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 行程 ─────────────────────────────────────────────────────────
    const itineraries = [
      {
        title: '長江三峽攬月八日遊',
        destination: '重慶、中國',
        description: '搭乘豪華遊輪，暢遊長江三峽，欣賞壯麗的峽谷風光。行程包含白帝城、神女峰、三峽大壩等著名景點，深度體驗中國山水文化。',
        start_date: '2026-07-10',
        end_date: '2026-07-17',
        price: 45800,
        max_seats: 30,
        tags: ['國外旅遊', '郵輪'],
        cover_image: 'https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=800',
        status: 'published',
      },
      {
        title: '北海道賞花美食十日遊',
        destination: '北海道、日本',
        description: '春季限定！暢遊北海道各大花田，欣賞薰衣草、鬱金香盛放的美麗景色。品嚐正宗北海道海鮮、乳製品，入住頂級溫泉旅館。',
        start_date: '2026-06-20',
        end_date: '2026-06-29',
        price: 68000,
        max_seats: 20,
        tags: ['國外旅遊', '日本', '賞花'],
        cover_image: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=800',
        status: 'published',
      },
      {
        title: '義大利文藝復興深度遊',
        destination: '羅馬、佛羅倫斯、威尼斯',
        description: '走訪羅馬競技場、梵蒂岡博物館、烏菲茲美術館，深入體驗義大利文藝復興藝術與文化。品嚐道地義式料理，漫步威尼斯水都。',
        start_date: '2026-09-05',
        end_date: '2026-09-16',
        price: 89000,
        max_seats: 16,
        tags: ['國外旅遊', '歐洲', '文化'],
        cover_image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800',
        status: 'published',
      },
      {
        title: '花蓮太魯閣三日遊',
        destination: '花蓮、台灣',
        description: '探索太魯閣國家公園的壯麗峽谷，漫步清水斷崖，體驗原住民文化。入住花蓮民宿，品嚐在地美食，感受台灣東部純樸之美。',
        start_date: '2026-08-01',
        end_date: '2026-08-03',
        price: 12800,
        max_seats: 25,
        tags: ['國內旅遊', '自然', '台灣'],
        cover_image: 'https://images.unsplash.com/photo-1609694688310-0c7f2a5f2dae?w=800',
        status: 'published',
      },
      {
        title: '澎湖海島風情五日遊',
        destination: '澎湖、台灣',
        description: '搭船探訪澎湖群島，享受碧海藍天的南洋風情。浮潛、賞鯨、騎車環島，品嚐澎湖海鮮料理，體驗台灣最美麗的離島風光。',
        start_date: '2026-07-25',
        end_date: '2026-07-29',
        price: 18500,
        max_seats: 20,
        tags: ['國內旅遊', '海島', '台灣'],
        cover_image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800',
        status: 'published',
      },
      {
        title: '越南峴港芽莊悠遊八日',
        destination: '峴港、芽莊、越南',
        description: '越南中部精華行程！走訪世界文化遺產會安古城，暢玩芽莊海灘，體驗越南傳統文化與美食。性價比極高的東南亞旅遊首選。',
        start_date: '2026-10-10',
        end_date: '2026-10-17',
        price: 35000,
        max_seats: 24,
        tags: ['國外旅遊', '東南亞', '海灘'],
        cover_image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800',
        status: 'published',
      },
    ];

    for (const it of itineraries) {
      await client.query(
        `INSERT INTO itineraries
           (title, destination, description, start_date, end_date, price,
            max_seats, available_seats, tags, cover_image, status,
            confirmation_message)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11)
         ON CONFLICT DO NOTHING`,
        [
          it.title, it.destination, it.description,
          it.start_date, it.end_date, it.price,
          it.max_seats, it.tags, it.cover_image, it.status,
          '感謝您的報名！我們將於 3 個工作天內與您確認行程細節，請留意電話或 Email 通知。',
        ]
      );
    }

    // ── 公告 ─────────────────────────────────────────────────────────
    const announcements = [
      {
        title: '🎉 暑假行程早鳥優惠開跑！',
        content: '即日起至 6/30，預訂 7-9 月出發的行程享九折優惠，並附贈旅行保險！名額有限，手刀預訂！',
        priority: 'high',
        status: 'published',
        publish_date: '2026-05-01',
        author: '綠野旅行社',
      },
      {
        title: '📢 端午連假出團公告',
        content: '端午節連假（6/18-6/22）期間正常出團，客服服務時間為 09:00-18:00。如有行程疑問，請提前與我們聯繫。',
        priority: 'high',
        status: 'published',
        publish_date: '2026-05-10',
        author: '綠野旅行社',
      },
      {
        title: '✈️ 新增越南、義大利行程',
        content: '因應旅客需求，本月新增越南峴港芽莊及義大利文藝復興深度遊兩條行程，歡迎洽詢報名！',
        priority: 'medium',
        status: 'published',
        publish_date: '2026-05-15',
        author: '綠野旅行社',
      },
      {
        title: '🌸 長者優惠專案',
        content: '65 歲以上旅客參加任一行程，享 95 折優惠。請於報名時出示身分證件，優惠以一人為限。',
        priority: 'low',
        status: 'published',
        publish_date: '2026-04-20',
        author: '綠野旅行社',
      },
    ];

    for (const ann of announcements) {
      await client.query(
        `INSERT INTO announcements (title, content, priority, status, publish_date, author)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT DO NOTHING`,
        [ann.title, ann.content, ann.priority, ann.status, ann.publish_date, ann.author]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Seed 完成：', itineraries.length, '筆行程、', announcements.length, '筆公告');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed 失敗：', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
