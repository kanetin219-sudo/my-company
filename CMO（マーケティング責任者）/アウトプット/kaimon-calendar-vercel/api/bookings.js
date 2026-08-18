const GAS_URL = 'https://script.google.com/macros/s/AKfycbwr2GucgYR7LQOca33a1ptV8DzieOAebnPouD1fhcUM99PrCpSUf_sb3Jr5dAN4fYBygA/exec';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const response = await fetch(GAS_URL, {
      headers: { 'Accept': 'application/json' }
    });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
