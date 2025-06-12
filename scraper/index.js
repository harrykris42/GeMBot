const axios = require('axios');
const { format } = require('date-fns');
const { syncBidsToSupabase } = require('./supabase');

const csrfToken = '0a836a8d16e22707774a9824a23cf72f';
const COOKIE = 'bm_s=YAAQVpUjF/1aI8iWAQAAnUPi1ANPlW8L3AnYPl4NnQi9U4ilGboCRrUxxjy23Eds2DKpWz2BCp3Feju8yTrRx97fdvH1MpdCMzJZ/DpoymFuavsF+cBNSCRqZD5mSOkmyEcXfYVhh2EH8xd3JBH0GHchj8pOnTwNTMjwzShdQJL95imA/KUgtpDEac1J72UQfYyr0Ch7p+FBHciGPO+n88drLabhiA0P8/QWfQTW636uPbgUUsS4h9Q2O+kjjjwkb7lB8D2fchvcI5KblF7ksE80Bd0VbIyyoWra4EXrlY/yKq/yXdTqQ9zmN/daWEYvxqwQ2u6loA/cvk0DoOkEAUIgWCZAC+ED2MzTiOipC0l1ICle6ZGZUFymPvtwftIIyiNMe+zTEHpsncaVEnZ91tyfSOzatDRQRZrwDWZurcBEfn7337XwECOZOh3nPbImkMzvKTxkkQmhcSTHDxDjtJr+TA9CVdMpMcxcgaJxXl6Gv+LE7JYnAyORT/tH6BQEGr5h5wFIPWUjMR9WakcX8DK6zfena53ARXbwkg8nqF055hUshvwIUZH/rcwidQw=; themeOption=0; _gid=GA1.3.1939171643.1749707972; csrf_gem_cookie=0a836a8d16e22707774a9824a23cf72f; GeM=1542078820.20480.0000; _ga=GA1.3.182433388.1748250425; ci_session=89f21afa5cc634fb40ce8a9560351f5c5d933393; TS01dc9e29=01e393167d683dbe0571266d42a13c7e3d449fd011bb91341461175d64c2bd96d2a89f16c3a7c6d5efbea2f466432c1fd823432e64681fdbc65febe5c24533e6031a2d0643; TS0123c430=01e393167d6b2b446e0341582d309be04375dbf5ad3e0da7da34999b7be7b044e83631a0e1d88d5cccdde47e729a96d5efa24aafe0a96352422933b12bf3a2c27c4b658c01a0c7e9ea994e462b885c659d46329e19c44d1f6e0e15332fcf088a5721262cb3; _gat=1; _ga_MMQ7TYBESB=GS2.3.s1749707977$o32$g1$t1749711753$j60$l0$h0; TS9dc197d5027=082c9b9876ab2000a91b992c7a2b370ddc0338f1f0ea785f434ff3be34d974983ed95bb699d4c39408315b163f113000fcc111d0b8b1a0bfa7034791307fa4df580503b85725e0fc67608c32e98518b886c3c2bb91fce1b58bdd3ecdc05b9530'

const headers = {
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Origin': 'https://bidplus.gem.gov.in',
  'Referer': 'https://bidplus.gem.gov.in/advance-search',
  'Cookie': COOKIE
};

function formatDate(input) {
  try {
    const dt = new Date(input.replace(/Z$/, '')); // Remove misleading 'Z' if present
    return format(dt, 'yyyy-MM-dd HH:mm:00');
  } catch {
    return '';
  }
}

function isValidBid(bid_no) {
  return /^GEM\/\d{4}\/B\/\d+$/.test(bid_no);
}

async function fetchGemPage(page) {
  const payload = {
    searchType: 'ministry-search',
    ministry: 'Ministry of Defence',
    buyerState: '',
    organization: 'Indian Coast Guard',
    department: 'Department of Defence',
    bidEndFromMin: '',
    bidEndToMin: '',
    page: page
  };

  const formData = `payload=${encodeURIComponent(JSON.stringify(payload))}&csrf_bd_gem_nk=${csrfToken}`;
  const res = await axios.post('https://bidplus.gem.gov.in/search-bids', formData, { headers });

  const docs = res.data?.response?.response?.docs;
  const totalRecords = res.data?.response?.response?.numFound || 0;

  const validBids = (docs || []).map(doc => {
    const bid_no = doc.b_bid_number?.[0];
    const bid_id = doc.id;
    if (!isValidBid(bid_no)) return null;

    return {
      bid_no,
      boq: `https://bidplus.gem.gov.in/showbidDocument/${bid_id}`,
      start_date: formatDate(doc.final_start_date_sort?.[0]),
      end_date: formatDate(doc.final_end_date_sort?.[0])
    };
  }).filter(Boolean);

  return { totalRecords, bids: validBids };
}

(async () => {
  console.log('⚡ Starting full GeM scrape...');
  const allBids = [];

  const first = await fetchGemPage(1);
  console.log(`📊 Found ${first.totalRecords} total bids (raw)`);

  allBids.push(...first.bids);

  const totalRecords = first.totalRecords;
  const totalPages = totalRecords % 10 === 0
    ? totalRecords / 10
    : Math.floor(totalRecords / 10) + 1;

  for (let page = 2; page <= totalPages; page++) {
    const result = await fetchGemPage(page);
    allBids.push(...result.bids);
    console.log(`📦 Page ${page}/${totalPages} → +${result.bids.length} bids`);
  }

  console.log(`✅ Extracted ${allBids.length} valid bids matching GEM/YYYY/B/xxxxx`);
  console.table(allBids, ['bid_no', 'boq', 'start_date', 'end_date']);

  await syncBidsToSupabase(allBids);
})();
