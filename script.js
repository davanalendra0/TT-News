/* CONFIG */
const API = 'https://berita-indo-api-next.vercel.app/api';

/* FETCH */
async function fetchEndpoint(ep) {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, 10000);

    try {
        const res = await fetch(`${API}/${ep}`, {
            signal: controller.signal
        });
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
        }
        const data = await res.json();
        return Array.isArray(data.data)
            ? data.data
            : Array.isArray(data)
            ? data
            : [];
    } catch (err) {
        console.error('Fetch error:', ep, err);
        return [];
    } finally {
        clearTimeout(timeout);
    }
}

const CAT_COLORS = {
    politik:       '#ef4444',
    nasional:      '#10b981',
    internasional: '#8b5cf6',
    olahraga:      '#f59e0b',
    teknologi:     '#06b6d4',
    hiburan:       '#ec4899',
    ekonomi:       '#6366f1',
    'gaya-hidup':  '#f97316',
    terbaru:       '#1a6fe8',
    default:       '#1a6fe8',
};

const CAT_ENDPOINTS = {
    nasional:       'cnn-news/nasional',
    internasional:  'cnn-news/internasional',
    olahraga:       'cnn-news/olahraga',
    teknologi:      'cnn-news/teknologi',
    hiburan:        'cnn-news/hiburan',
    'gaya-hidup':   'cnn-news/gaya-hidup',
    terbaru:        'cnn-news',
    ekonomi:        'cnbc-news/market',
};

/* STATE */
let articleRegistry = [];
let allHomeNews     = [];
let filteredNews    = [];
let popularNews     = [];
let heroArticles    = [];
let currentHero     = 0;
let currentPage     = 1;
const PER_PAGE      = 8;
let catArticles     = [];
let catPage         = 1;

/* HELPERS */
function getCatColor(cat) {
    const key = (cat || '').toLowerCase().replace(/\s+/g, '-');
    return CAT_COLORS[key] || CAT_COLORS.default;
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const months = ['Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function registerArticle(a) {
    const found = articleRegistry.findIndex(x => x.link === a.link);
    if (found !== -1) return found;
    if (articleRegistry.length > 500) {
        articleRegistry.shift();
    }
    articleRegistry.push(a);
    return articleRegistry.length - 1;
}

function escHtml(s) {
    return String(s || '').replace(/[<>"'&]/g, c => ({
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '&': '&amp;'
    }[c]));
}

function getImageUrl(img) {
    if (!img) return '';
    if (typeof img === 'string') {
        return img;
    }
    if (typeof img === 'object') {
        return img.large || img.small || img.url || '';
    }
    return '';
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

/* INIT */
async function init() {
    const [cnn, antara, cnbc] = await Promise.all([
        fetchEndpoint('cnn-news'),
        fetchEndpoint('antara-news/terkini'),
        fetchEndpoint('cnbc-news/market'),
    ]);
    const tag = (arr, cat, src) =>
        arr.map(n => ({ ...n, _cat: cat, _src: src }));
    heroArticles = tag(cnn.slice(0, 5), 'Nasional', 'CNN Indonesia');
    popularNews = tag(
        [...cnn].slice(0, 3),
        'Nasional',
        'CNN Indonesia'
    );

    allHomeNews = [
        ...tag(cnn, 'Nasional', 'CNN Indonesia'),
        ...tag(antara, 'Nasional', 'Antara'),
        ...tag(cnbc, 'Ekonomi', 'CNBC'),
    ];

    filteredNews = [...allHomeNews];
    renderHero(0);
    renderPopular();
    renderGrid();
}

/* HERO */
function renderHero(idx) {
    if (!heroArticles.length) return;
    currentHero = idx;
    const a     = heroArticles[idx];
    const total = heroArticles.length;
    const id    = registerArticle(a);

    document.getElementById('heroWrap').innerHTML = `
        <div class="hero-wrap fade-in">
            <div>
                <div class="hero-label">Headline</div>
                <h1 class="hero-title">${escHtml(a.title)}</h1>
                <p class="hero-excerpt">${escHtml((a.contentSnippet || '').substring(0, 220))}</p>
                <div class="hero-meta">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <path d="M16 2v4M8 2v4M3 10h18"/>
                    </svg>
                    ${formatDate(a.isoDate || a.pubDate)}
                </div>
                <span class="hero-read-more" onclick="openDetail(${id})">Baca Selengkapnya ↗</span>
                <div class="hero-pager">
                    <button class="hero-pager-btn" onclick="renderHero(${(idx - 1 + total) % total})">‹</button>
                    <span>${idx + 1} dari ${total}</span>
                    <button class="hero-pager-btn" onclick="renderHero(${(idx + 1) % total})">›</button>
                </div>
            </div>
            <div class="hero-img-wrap">
                ${a.image
                ? `<img class="hero-img" src="${escHtml(getImageUrl(a.image))}" alt="${escHtml(a.title)}" loading="eager"
                    onerror="this.outerHTML='<div class=\\'hero-img-placeholder\\'>📰</div>'">`
                : '<div class="hero-img-placeholder">📰</div>'
                }
            </div>
        </div>`;
}

/* POPULAR */
function renderPopular() {
    if (!popularNews.length) {
        document.getElementById('popularGrid').innerHTML = '<div class="empty-box">Tidak ada data</div>';
        return;
    }

    document.getElementById('popularGrid').innerHTML = popularNews.slice(0, 3).map((a, i) => {
        const id  = registerArticle(a);
        const col = getCatColor(a._cat);
        return `
            <div class="pop-card fade-in" onclick="openDetail(${id})">
                <div class="pop-num">${i + 1}</div>
                ${a.image
                ? `<img class="pop-thumb" src="${escHtml(getImageUrl(a.image))}" alt="${escHtml(a.title)}" loading="lazy"
                    onerror="this.outerHTML='<div class=\\'pop-thumb-ph\\'></div>'">`
                : '<div class="pop-thumb-ph"></div>'
                }
                <div>
                    <div class="pop-title">${escHtml(a.title)}</div>
                    <div class="pop-meta">
                        <span class="cat-label" style="color:${col};">${escHtml(a._cat)}</span>
                        • ${formatDate(a.isoDate || a.pubDate)}
                    </div>
                </div>
            </div>`;
    }).join('');
}

/* NEWS GRID */
function renderGrid() {
    const start = (currentPage - 1) * PER_PAGE;
    const slice = filteredNews.slice(start, start + PER_PAGE);

    if (!slice.length) {
        document.getElementById('newsGrid').innerHTML  = '<div class="empty-box">Tidak ada berita ditemukan</div>';
        document.getElementById('pagerWrap').innerHTML = '';
        return;
    }

    document.getElementById('newsGrid').innerHTML = slice.map(a => {
        const id  = registerArticle(a);
        const col = getCatColor(a._cat);
        return `
        <div class="news-card fade-in" onclick="openDetail(${id})">
            ${a.image
                ? `<img class="nc-img" src="${escHtml(getImageUrl(a.image))}" alt="${escHtml(a.title)}" loading="lazy"
                    onerror="this.outerHTML='<div class=\\'nc-img-ph\\'></div>'">`
                : '<div class="nc-img-ph"></div>'
            }
            <div class="nc-title">${escHtml(a.title)}</div>
            <div class="nc-meta">
                <span class="cat-label" style="color:${col};">${escHtml(a._cat)}</span>
                • ${formatDate(a.isoDate || a.pubDate)}
            </div>
        </div>`;
    }).join('');

    renderPager(
        filteredNews.length,
        currentPage,
        PER_PAGE,
        'pagerWrap',
        (p) => { currentPage = p; renderGrid(); scrollToSection('.recommend-section'); }
    );
}

/* PAGINATION */
function renderPager(total, page, per, targetId, cb) {
    const pages = Math.ceil(total / per);
    const s     = (page - 1) * per + 1;
    const e     = Math.min(page * per, total);

    let html = `<span>Showing ${s} to ${e} of ${total} results</span><div class="pager">`;
    html += `<button class="pbtn" onclick="pagerCb_${targetId}(${page - 1})" ${page === 1 ? 'disabled' : ''}>« Previous</button>`;

    for (let i = 1; i <= pages; i++) {
        if (i === 1 || i === pages || (i >= page - 1 && i <= page + 1)) {
            html += `<button class="pbtn${i === page ? ' active' : ''}" onclick="pagerCb_${targetId}(${i})">${i}</button>`;
        } else if (i === page - 2 || i === page + 2) {
            html += `<button class="pbtn" style="pointer-events:none;border:none;">…</button>`;
        }
    }

    html += `<button class="pbtn" onclick="pagerCb_${targetId}(${page + 1})" ${page === pages ? 'disabled' : ''}>Next »</button>`;
    html += '</div>';

    document.getElementById(targetId).innerHTML = html;
    window[`pagerCb_${targetId}`] = cb;
}

/* SEARCH */
let searchTimeout;

function onSearch(q) {
    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
        const s = q.toLowerCase().trim();

        filteredNews = s
            ? allHomeNews.filter(a =>
                (a.title || '').toLowerCase().includes(s) ||
                (a.contentSnippet || '').toLowerCase().includes(s)
            )
            : [...allHomeNews];
        currentPage = 1;
        renderGrid();
    }, 300);
}

/* OPEN DETAIL */
function openDetail(id) {
    const a = articleRegistry[id];
    if (!a) return;

    showPage('detailPage');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const cat = a._cat || a.category || 'Nasional';
    const col = getCatColor(cat);

    document.getElementById('detailBcCat').textContent    = cat;
    document.getElementById('detailCat').textContent      = cat;
    document.getElementById('detailCat').style.color      = col;
    document.getElementById('detailDate').textContent     = formatDate(a.isoDate || a.pubDate);
    document.getElementById('detailTitle').textContent    = a.title || '';
    document.getElementById('detailImgWrap').innerHTML = a.image
        ? `<img class="detail-img" src="${escHtml(getImageUrl(a.image))}" alt="${escHtml(a.title)}"
            onerror="this.outerHTML='<div class=\\'detail-img-ph\\'></div>'">`
        : '<div class="detail-img-ph"></div>';
    document.getElementById('detailCaption').textContent = a.creator || a._src || '';

    const raw = a.content || a.contentSnippet || 'Klik link di bawah untuk membaca berita lengkap.';
    document.getElementById('detailBody').innerHTML =
        raw.split('\n').filter(Boolean).map(p => `<p>${escHtml(p)}</p>`).join('') ||
        `<p>${escHtml(raw)}</p>`;
    document.getElementById('detailLinkWrap').innerHTML = a.link
        ? `<a href="${escHtml(a.link)}" target="_blank" rel="noopener"
            style="color:var(--primary);font-size:14px;font-weight:600;">
            Baca berita lengkap di sumber asli ↗
        </a>`
        : '';

    // Sidebar popular
    document.getElementById('sidebarPopular').innerHTML = popularNews.slice(0, 3).map((n, i) => {
        const nid = registerArticle(n);
        return `
        <div class="sb-card" onclick="openDetail(${nid})">
            <div class="pop-num" style="width:26px;height:26px;font-size:11px;flex-shrink:0;">${i + 1}</div>
            ${n.image
                ? `<img class="sb-thumb" src="${escHtml(getImageUrl(n.image))}" alt="${escHtml(n.title)}"
                    onerror="this.outerHTML='<div class=\\'sb-thumb-ph\\'></div>'">`
                : '<div class="sb-thumb-ph"></div>'
            }
            <div>
                <div class="sb-title">${escHtml(n.title)}</div>
                <div class="sb-meta">
                    <span style="color:${getCatColor(n._cat)};font-size:11px;font-weight:700;">${escHtml(n._cat || '')}</span>
                    • ${formatDate(n.isoDate || n.pubDate)}
                </div>
            </div>
        </div>`;
    }).join('');

    // Related news
    const related = allHomeNews
    .filter(n =>
        n.title !== a.title &&
        n._cat === a._cat
    )
    .slice(0, 3);
    document.getElementById('relatedGrid').innerHTML = related.map(n => {
        const nid = registerArticle(n);
        return `
            <div class="news-card fade-in" onclick="openDetail(${nid})">
                ${n.image
                    ? `<img class="nc-img" src="${escHtml(getImageUrl(n.image))}" alt="${escHtml(n.title)}" loading="lazy"
                        onerror="this.outerHTML='<div class=\\'nc-img-ph\\'></div>'">`
                    : '<div class="nc-img-ph"></div>'
                }
                <div class="nc-title">${escHtml(n.title)}</div>
                <div class="nc-meta">
                    <span style="color:${getCatColor(n._cat)};font-size:11px;font-weight:700;">${escHtml(n._cat || '')}</span>
                    • ${formatDate(n.isoDate || n.pubDate)}
                </div>
            </div>`;
    }).join('');
}

/* CATEGORY PAGE */
async function loadCategory(cat) {
    showPage('catPage');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    catPage = 1;

    const label = cat.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());
    const col   = getCatColor(cat);

    document.getElementById('catPageTitle').innerHTML =
        `<span style="border-left:4px solid ${col};padding-left:12px;">${label}</span>`;
    document.getElementById('catGrid').innerHTML  = '<div class="loading-box"><div class="spinner"></div>Memuat berita...</div>';
    document.getElementById('catPager').innerHTML = '';

    const ep   = CAT_ENDPOINTS[cat] || 'cnn-news';
    const data = await fetchEndpoint(ep);
    catArticles = data.map(n => ({ ...n, _cat: label, _src: 'CNN Indonesia' }));

    if (!catArticles.length) {
        document.getElementById('catGrid').innerHTML = '<div class="empty-box">Tidak ada berita tersedia saat ini.</div>';
        return;
    }

    renderCatGrid();
}

function renderCatGrid() {
    const start = (catPage - 1) * PER_PAGE;
    const slice = catArticles.slice(start, start + PER_PAGE);
    const col   = getCatColor(catArticles[0]?._cat || '');

    document.getElementById('catGrid').innerHTML = slice.map(a => {
        const id = registerArticle(a);
        return `
        <div class="news-card fade-in" onclick="openDetail(${id})">
            ${a.image
                ? `<img class="nc-img" src="${escHtml(getImageUrl(a.image))}" alt="${escHtml(a.title)}" loading="lazy"
                    onerror="this.outerHTML='<div class=\\'nc-img-ph\\'></div>'">`
                : '<div class="nc-img-ph"></div>'
            }
            <div class="nc-title">${escHtml(a.title)}</div>
            <div class="nc-meta">
                <span style="color:${col};font-size:11px;font-weight:700;">${escHtml(a._cat || '')}</span>
                • ${formatDate(a.isoDate || a.pubDate)}
            </div>
        </div>`;
    }).join('');

    renderPager(
        catArticles.length,
        catPage,
        PER_PAGE,
        'catPager',
        (p) => { catPage = p; renderCatGrid(); scrollToSection('.cat-container'); }
    );
}

/* PAGE ROUTING */
function showPage(id) {
    ['homePage', 'detailPage', 'catPage'].forEach(p => {
        document.getElementById(p).classList.toggle('active', p === id);
    });
}

function showHome() {
    showPage('homePage');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveNav('');
}

function navClick(el, cat) {
    if (el) setActiveNav(cat);
    if (cat === '') { showHome(); return; }
    loadCategory(cat);
}

function setActiveNav(cat) {
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.getAttribute('data-cat') === cat);
    });
}

function scrollToSection(sel) {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* COMMENTS */
function updateChar() {
    document.getElementById('charCount').textContent =
        document.getElementById('commentInput').value.length;
}

function submitComment() {
    const val = document.getElementById('commentInput').value.trim();
    if (!val) { showToast('Tulis komentar terlebih dahulu.'); return; }
    showToast('Komentar terkirim! (Demo)');
    document.getElementById('commentInput').value   = '';
    document.getElementById('charCount').textContent = '0';
}

/* NEWSLETTER */
function subscribeNewsletter() {
    const email = document.getElementById('nlEmail').value.trim();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
        showToast('Masukkan email yang valid.');
        return;
    }
    showToast(`Berhasil berlangganan dengan ${email}!`);
    document.getElementById('nlEmail').value = '';
}

/* HAMBURGER MENU */
function toggleMenu() {
    document.getElementById('navLinks').classList.toggle('open');
}

/* SCROLL NAVBAR */
window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

/* AUTO HERO SLIDE (setiap 6 detik) */
let heroInterval = setInterval(() => {
    if (
        heroArticles.length &&
        document.getElementById('homePage').classList.contains('active')
    ) {
        renderHero((currentHero + 1) % heroArticles.length);
    }
}, 6000);

/* START */
init();