import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const adminUrl = process.env.ADMIN_DASHBOARD_URL || 'https://supabase.com/dashboard/projects';

  if (!botToken || !chatId) {
    console.error('⚠️ [Telegram Bot] 缺少環境變數設定。');
    return NextResponse.json({ success: false, message: 'Credentials missing' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, spot_name, category, quote, description, image_url } = body;

    let message = '';
    const time = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

    if (type === 'new_spot') {
      message = `
🌿 <b>【野台東 - 新秘境投稿】</b>
📌 <b>景點名稱：</b> ${spot_name}
📍 <b>旅行路線：</b> ${category}
💬 <b>探險家短評：</b> ${quote}
${image_url ? `📸 <b>秘境實景：</b> <a href="${image_url}">點此查看照片</a>\n` : ''}⏱️ <b>投稿時間：</b> ${time}

🔗 <a href="${adminUrl}">👉 點此開啟 Supabase 進入後台審查</a>
      `;
    } else if (type === 'new_food') {
      message = `
🎪 <b>【野台東 - 新店家上架申請】</b>
📌 <b>店家名稱：</b> ${spot_name}
📍 <b>區域 / 分類：</b> ${category}
💬 <b>主理人情懷：</b> ${quote}
${image_url ? `🍱 <b>招牌美味：</b> <a href="${image_url}">點此查看照片</a>\n` : ''}⏱️ <b>申請時間：</b> ${time}

🔗 <a href="${adminUrl}">👉 點此開啟 Supabase 進入後台審查</a>
      `;
    } else {
      message = `🔔 <b>【系統通知】</b>\n📌 <b>內容：</b> ${description}`;
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const resData = await response.json();
    return NextResponse.json({ success: response.ok, data: resData }, { status: response.ok ? 200 : 400 });
  } catch (error) {
    console.error('❌ [Telegram Bot] API 出錯:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
