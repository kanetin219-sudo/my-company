const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1513841762412531816/K96zcsvPdu2Ae2zm3GhgFBQeZLGyb_5KhNQEXhVu-sRrtuRRgaT-M2rskGGyc_hncSnd';

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body = await request.text();

    const response = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    });

    return new Response(null, { status: 200 });
  }
};
