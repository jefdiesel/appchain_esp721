// Template system for gas-efficient inscriptions
// Templates are inscribed once, posts reference them by tx hash

// ============================================
// TYPES
// ============================================

export interface Template {
  id: string;
  name: string;
  type: 'blog' | 'links' | 'portfolio' | 'wallet' | 'custom';
  css: string;
  html: string; // HTML with {{placeholders}}
  fields: string[]; // Required fields for this template
  version: string;
}

export interface ImageAttachment {
  src: string;       // URL or tx hash
  alt: string;       // REQUIRED - accessibility
  caption?: string;  // Optional caption
}

// ============================================
// ACCESSIBILITY UTILITIES
// ============================================

// Validate image has alt text (required)
export function validateImage(image: ImageAttachment): { valid: boolean; error?: string } {
  if (!image.src) {
    return { valid: false, error: 'Image source is required' };
  }
  if (!image.alt || image.alt.trim().length === 0) {
    return { valid: false, error: 'Alt text is required for accessibility' };
  }
  if (image.alt.length < 3) {
    return { valid: false, error: 'Alt text must be descriptive (at least 3 characters)' };
  }
  if (image.alt.toLowerCase() === 'image' || image.alt.toLowerCase() === 'picture') {
    return { valid: false, error: 'Alt text must be descriptive, not just "image" or "picture"' };
  }
  return { valid: true };
}

// Validate all images in content
export function validateImages(images: ImageAttachment[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  images.forEach((img, i) => {
    const result = validateImage(img);
    if (!result.valid) {
      errors.push(`Image ${i + 1}: ${result.error}`);
    }
  });
  return { valid: errors.length === 0, errors };
}

// Generate accessible image HTML
export function generateImageHtml(image: ImageAttachment): string {
  const validation = validateImage(image);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const src = getImageSrc(image.src);
  const figcaption = image.caption
    ? `<figcaption>${escapeHtml(image.caption)}</figcaption>`
    : '';

  return `<figure role="img" aria-label="${escapeHtml(image.alt)}">
  <img src="${src}" alt="${escapeHtml(image.alt)}" loading="lazy">
  ${figcaption}
</figure>`;
}

// Helper: resolve image source (URL or tx hash)
function getImageSrc(src: string): string {
  if (!src) return '';
  if (src.startsWith('0x') && src.length === 66) {
    return `https://ethscriptions.com/ethscriptions/${src}/content`;
  }
  return src;
}

export interface TemplateRef {
  ref: string; // Template tx hash
  data: Record<string, unknown>; // Field values
}

export interface Post {
  ref: string; // Template tx hash
  title?: string;
  author?: string;
  content?: string;
  keywords?: string;
  links?: Array<{ label: string; url: string; icon?: string }>;
  name?: string;
  tagline?: string;
  bio?: string;
  email?: string;
  [key: string]: unknown;
}

// ============================================
// SYSTEM TEMPLATES (inscribed by Chainhost)
// ============================================

// These will be replaced with actual tx hashes after inscription
export const SYSTEM_TEMPLATES: Record<string, string> = {
  'blog-v1': '', // Will be 0x... after inscription
  'links-v1': '',
  'portfolio-v1': '',
};

// Template definitions (what gets inscribed)
export const TEMPLATE_DEFINITIONS: Record<string, Template> = {
  // ============================================
  // CLASSIC DEGEN - Black + #C3FF00
  // ============================================
  'classic-degen': {
    id: 'classic-degen',
    name: 'Classic Degen',
    type: 'blog',
    version: '1.0',
    fields: ['title', 'author', 'content', 'keywords'],
    css: `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,serif;background:#000;color:#ddd;min-height:100vh;padding:60px 20px}
.skip-link{position:absolute;top:-40px;left:0;background:#C3FF00;color:#000;padding:8px 16px;z-index:100;text-decoration:none;font-family:system-ui,sans-serif}
.skip-link:focus{top:0}
main{max-width:650px;margin:0 auto}
article{outline:none}
h1{font-size:2.5rem;color:#fff;margin-bottom:1rem;line-height:1.2}
.meta{color:#888;margin-bottom:1rem;font-family:system-ui,sans-serif;font-size:0.9rem}
.tags{margin-bottom:2rem}
.tags ul{list-style:none;display:flex;flex-wrap:wrap;gap:6px}
.tag{display:inline-block;background:#111;color:#C3FF00;padding:4px 12px;border-radius:20px;font-size:12px;font-family:system-ui,sans-serif}
.content{font-size:1.2rem;line-height:1.8}
.content p{margin-bottom:1.5rem}
.content figure{margin:2rem 0}
.content img{max-width:100%;height:auto;border-radius:8px}
.content figcaption{color:#888;font-size:0.9rem;margin-top:0.5rem;font-style:italic}
a{color:#C3FF00}
a:focus{outline:2px solid #C3FF00;outline-offset:2px}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{title}}</title>
<meta name="description" content="{{title}} by {{author}}">
<style>{{css}}</style>
</head>
<body>
<a href="#main-content" class="skip-link">Skip to content</a>
<main id="main-content" role="main">
<article aria-labelledby="post-title">
<header>
<h1 id="post-title">{{title}}</h1>
<p class="meta">by <span rel="author">{{author}}</span></p>
</header>
{{#keywords}}<nav aria-label="Post tags"><ul class="tags" role="list">{{keywords_html}}</ul></nav>{{/keywords}}
<div class="content" role="article">{{content_html}}</div>
</article>
</main>
</body>
</html>`,
  },

  // ============================================
  // CLEAN LIGHT - White + Grey + Blue
  // ============================================
  'clean-light': {
    id: 'clean-light',
    name: 'Clean Light',
    type: 'blog',
    version: '1.0',
    fields: ['title', 'author', 'content', 'keywords'],
    css: `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#333;min-height:100vh;padding:60px 20px}
.skip-link{position:absolute;top:-40px;left:0;background:#3b82f6;color:#fff;padding:8px 16px;z-index:100;text-decoration:none}
.skip-link:focus{top:0}
main{max-width:680px;margin:0 auto}
article{outline:none}
h1{font-size:2.5rem;color:#111;margin-bottom:0.75rem;line-height:1.3;font-weight:700}
.meta{color:#666;margin-bottom:1.5rem;font-size:0.9rem}
.tags{margin-bottom:2rem}
.tags ul{list-style:none;display:flex;flex-wrap:wrap;gap:6px}
.tag{display:inline-block;background:#f0f4f8;color:#1d4ed8;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:500}
.content{font-size:1.125rem;line-height:1.9;color:#444}
.content p{margin-bottom:1.5rem}
.content figure{margin:2rem 0}
.content img{max-width:100%;height:auto;border-radius:8px}
.content figcaption{color:#666;font-size:0.9rem;margin-top:0.5rem;font-style:italic}
a{color:#2563eb;text-decoration:underline}
a:hover{color:#1d4ed8}
a:focus{outline:2px solid #3b82f6;outline-offset:2px}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{title}}</title>
<meta name="description" content="{{title}} by {{author}}">
<style>{{css}}</style>
</head>
<body>
<a href="#main-content" class="skip-link">Skip to content</a>
<main id="main-content" role="main">
<article aria-labelledby="post-title">
<header>
<h1 id="post-title">{{title}}</h1>
<p class="meta">by <span rel="author">{{author}}</span></p>
</header>
{{#keywords}}<nav aria-label="Post tags"><ul class="tags" role="list">{{keywords_html}}</ul></nav>{{/keywords}}
<div class="content" role="article">{{content_html}}</div>
</article>
</main>
</body>
</html>`,
  },

  // ============================================
  // RETRO BLOGGER - Nostalgic 2000s blog vibes
  // ============================================
  'retro-blogger': {
    id: 'retro-blogger',
    name: 'Retro Blogger',
    type: 'blog',
    version: '1.0',
    fields: ['title', 'author', 'content', 'keywords'],
    css: `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,'Times New Roman',serif;background:#f5f5dc;color:#333;min-height:100vh;padding:40px 20px}
.skip-link{position:absolute;top:-40px;left:0;background:#2c3e50;color:#fff;padding:8px 16px;z-index:100;text-decoration:none}
.skip-link:focus{top:0}
.wrapper{max-width:800px;margin:0 auto;background:#fff;border:1px solid #ccc;box-shadow:2px 2px 8px rgba(0,0,0,0.1)}
header{background:linear-gradient(to right,#2c3e50,#3498db);color:#fff;padding:30px;text-align:center}
h1{font-size:2rem;margin-bottom:0.5rem;text-shadow:1px 1px 2px rgba(0,0,0,0.3)}
.meta{font-size:0.85rem;opacity:0.9;font-style:italic}
main{padding:30px;outline:none}
.tags{margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px dashed #ccc}
.tags ul{list-style:none;display:flex;flex-wrap:wrap;gap:5px}
.tag{display:inline-block;background:#e8e8e8;color:#555;padding:3px 10px;border-radius:3px;font-size:11px;font-family:Verdana,sans-serif}
.content{font-size:1.1rem;line-height:1.9}
.content p{margin-bottom:1.25rem;text-indent:1.5em}
.content p:first-child{text-indent:0}
.content p:first-child::first-letter{font-size:3rem;float:left;margin-right:8px;line-height:1;color:#2c3e50}
.content figure{margin:2rem 0;text-indent:0}
.content img{max-width:100%;height:auto;border:1px solid #ccc}
.content figcaption{color:#666;font-size:0.9rem;margin-top:0.5rem;font-style:italic;text-indent:0}
footer{background:#f0f0f0;padding:15px 30px;font-size:0.8rem;color:#666;text-align:center;border-top:1px solid #ddd}
a{color:#2980b9}
a:focus{outline:2px solid #3498db;outline-offset:2px}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{title}}</title>
<meta name="description" content="{{title}} by {{author}}">
<style>{{css}}</style>
</head>
<body>
<a href="#main-content" class="skip-link">Skip to content</a>
<div class="wrapper" role="document">
<header role="banner">
<h1 id="post-title">{{title}}</h1>
<p class="meta">Posted by <span rel="author">{{author}}</span></p>
</header>
<main id="main-content" role="main">
<article aria-labelledby="post-title">
{{#keywords}}<nav aria-label="Post tags"><ul class="tags" role="list">{{keywords_html}}</ul></nav>{{/keywords}}
<div class="content" role="article">{{content_html}}</div>
</article>
</main>
<footer role="contentinfo">Powered by Chainhost - Permanent blogs on the blockchain</footer>
</div>
</body>
</html>`,
  },

  // ============================================
  // TEMPLATE GUIDE - How to make templates
  // ============================================
  'template-guide': {
    id: 'template-guide',
    name: 'Template Guide',
    type: 'blog',
    version: '1.0',
    fields: ['title', 'author', 'content', 'keywords'],
    css: `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;background:#0d1117;color:#c9d1d9;min-height:100vh;padding:40px 20px}
.skip-link{position:absolute;top:-40px;left:0;background:#58a6ff;color:#0d1117;padding:8px 16px;z-index:100;text-decoration:none;font-weight:600}
.skip-link:focus{top:0}
main{max-width:750px;margin:0 auto;outline:none}
h1{font-size:2rem;color:#58a6ff;margin-bottom:0.5rem;border-bottom:1px solid #30363d;padding-bottom:0.5rem}
.meta{color:#8b949e;margin-bottom:2rem;font-size:0.85rem}
.tags{margin-bottom:1.5rem}
.tags ul{list-style:none;display:flex;flex-wrap:wrap;gap:6px}
.tag{display:inline-block;background:#238636;color:#fff;padding:3px 8px;border-radius:4px;font-size:11px}
.content{font-size:1rem;line-height:1.8}
.content p{margin-bottom:1.25rem}
.content code{background:#161b22;padding:2px 6px;border-radius:4px;color:#f0883e;font-size:0.9em}
.content pre{background:#161b22;padding:16px;border-radius:8px;overflow-x:auto;margin:1.5rem 0}
.content pre code{background:none;padding:0;color:#c9d1d9}
.content h2{color:#58a6ff;font-size:1.3rem;margin:2rem 0 1rem;border-bottom:1px solid #30363d;padding-bottom:0.3rem}
.content figure{margin:2rem 0}
.content img{max-width:100%;height:auto;border-radius:8px}
.content figcaption{color:#8b949e;font-size:0.9rem;margin-top:0.5rem;font-style:italic}
a{color:#58a6ff}
a:focus{outline:2px solid #58a6ff;outline-offset:2px}
.tip{background:#1f2a37;border-left:3px solid #58a6ff;padding:12px 16px;margin:1.5rem 0;border-radius:0 6px 6px 0}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{title}}</title>
<meta name="description" content="{{title}} by {{author}}">
<style>{{css}}</style>
</head>
<body>
<a href="#main-content" class="skip-link">Skip to content</a>
<main id="main-content" role="main">
<article aria-labelledby="post-title">
<header>
<h1 id="post-title">{{title}}</h1>
<p class="meta">by <span rel="author">{{author}}</span></p>
</header>
{{#keywords}}<nav aria-label="Post tags"><ul class="tags" role="list">{{keywords_html}}</ul></nav>{{/keywords}}
<div class="content" role="article">{{content_html}}</div>
</article>
</main>
</body>
</html>`,
  },

  // ============================================
  // LINKS - Classic Degen style
  // ============================================
  'links-v1': {
    id: 'links-v1',
    name: 'Link Tree',
    type: 'links',
    version: '1.0',
    fields: ['name', 'tagline', 'links'],
    css: `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
.skip-link{position:absolute;top:-40px;left:0;background:#C3FF00;color:#000;padding:8px 16px;z-index:100;text-decoration:none;font-weight:600}
.skip-link:focus{top:0}
main{max-width:400px;width:100%;padding:40px 20px;text-align:center;outline:none}
header{margin-bottom:2rem}
h1{font-size:1.75rem;margin-bottom:0.5rem}
.tagline{color:#888}
nav[aria-label="Links"]{display:flex;flex-direction:column;gap:12px}
.link{display:flex;align-items:center;gap:12px;padding:12px 20px;background:#111;border:1px solid #333;border-radius:12px;color:#fff;text-decoration:none;transition:all 0.2s}
.link:hover{background:#C3FF00;color:#000;border-color:#C3FF00}
.link:focus{outline:2px solid #C3FF00;outline-offset:2px}
.icon{width:32px;height:32px;border-radius:6px;object-fit:cover}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{name}} - Links</title>
<meta name="description" content="{{tagline}}">
<style>{{css}}</style>
</head>
<body>
<a href="#main-content" class="skip-link">Skip to links</a>
<main id="main-content" role="main">
<header>
<h1 id="page-title">{{name}}</h1>
<p class="tagline">{{tagline}}</p>
</header>
<nav aria-label="Links" aria-describedby="page-title">{{links_html}}</nav>
</main>
</body>
</html>`,
  },

  // ============================================
  // PORTFOLIO - Classic Degen style
  // ============================================
  'portfolio-v1': {
    id: 'portfolio-v1',
    name: 'Minimal Portfolio',
    type: 'portfolio',
    version: '1.0',
    fields: ['name', 'tagline', 'bio', 'email'],
    css: `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
.skip-link{position:absolute;top:-40px;left:0;background:#C3FF00;color:#000;padding:8px 16px;z-index:100;text-decoration:none;font-weight:600}
.skip-link:focus{top:0}
main{max-width:600px;padding:40px 20px;text-align:center;outline:none}
h1{font-size:3rem;margin-bottom:0.5rem}
.tagline{color:#888;font-size:1.25rem;margin-bottom:2rem}
.bio{color:#aaa;line-height:1.6;margin-bottom:2rem}
.contact{margin-top:2rem}
.email{color:#C3FF00;text-decoration:none;font-size:1.1rem}
.email:hover{text-decoration:underline}
.email:focus{outline:2px solid #C3FF00;outline-offset:4px}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{name}} - Portfolio</title>
<meta name="description" content="{{tagline}}">
<style>{{css}}</style>
</head>
<body>
<a href="#main-content" class="skip-link">Skip to content</a>
<main id="main-content" role="main">
<article aria-labelledby="page-title">
<header>
<h1 id="page-title">{{name}}</h1>
<p class="tagline" role="doc-subtitle">{{tagline}}</p>
</header>
<section aria-label="About">
<p class="bio">{{bio}}</p>
</section>
<footer class="contact">
<a class="email" href="mailto:{{email}}" aria-label="Email {{name}}">{{email}}</a>
</footer>
</article>
</main>
</body>
</html>`,
  },

  // ============================================
  // WALLET PORTFOLIO - Classic Degen style
  // ============================================
  'wallet-classic-degen': {
    id: 'wallet-classic-degen',
    name: 'Wallet Portfolio (Classic Degen)',
    type: 'wallet',
    version: '1.0',
    fields: ['wallet_address', 'display_name', 'view_mode'],
    css: `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh}
.skip-link{position:absolute;top:-40px;left:0;background:#C3FF00;color:#000;padding:8px 16px;z-index:100;text-decoration:none;font-weight:600}
.skip-link:focus{top:0}
main{max-width:1200px;margin:0 auto;padding:40px 20px;outline:none}
header{text-align:center;margin-bottom:2rem}
h1{font-size:2rem;margin-bottom:0.5rem}
.wallet{color:#888;font-family:monospace;font-size:0.9rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.feed{display:flex;flex-direction:column;gap:20px;max-width:600px;margin:0 auto}
.item{background:#111;border:1px solid #333;border-radius:12px;overflow:hidden;transition:all 0.2s}
.item:hover{border-color:#C3FF00}
.item img{width:100%;aspect-ratio:1;object-fit:cover}
.feed .item img{aspect-ratio:auto;max-height:500px}
.item-info{padding:12px}
.item-id{color:#888;font-size:0.8rem;font-family:monospace}
a{color:#C3FF00;text-decoration:none}
a:hover{text-decoration:underline}
a:focus{outline:2px solid #C3FF00;outline-offset:2px}
.loading{text-align:center;padding:40px;color:#888}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{display_name}} - Ethscriptions</title>
<meta name="description" content="Ethscriptions collection for {{display_name}}">
<style>{{css}}</style>
</head>
<body>
<a href="#main-content" class="skip-link">Skip to content</a>
<main id="main-content" role="main">
<header>
<h1 id="page-title">{{display_name}}</h1>
<p class="wallet">{{wallet_address}}</p>
</header>
<section aria-label="Ethscriptions collection" class="{{view_mode}}" id="collection">
<div class="loading">Loading ethscriptions...</div>
</section>
</main>
<script>
(async function(){
const wallet='{{wallet_address}}';
const container=document.getElementById('collection');
try{
const res=await fetch('https://api.ethscriptions.com/v2/ethscriptions?current_owner='+wallet+'&per_page=50');
const data=await res.json();
if(!data.result||data.result.length===0){
container.innerHTML='<p style="text-align:center;color:#888">No ethscriptions found</p>';
return;
}
container.innerHTML=data.result.map(e=>\`
<article class="item">
<a href="https://ethscriptions.com/ethscriptions/\${e.transaction_hash}" target="_blank" rel="noopener">
<img src="https://api.ethscriptions.com/v2/ethscriptions/\${e.transaction_hash}/content" alt="Ethscription \${e.transaction_hash.slice(0,10)}" loading="lazy">
<div class="item-info">
<p class="item-id">\${e.transaction_hash.slice(0,10)}...</p>
</div>
</a>
</article>
\`).join('');
}catch(err){
container.innerHTML='<p style="text-align:center;color:#f66">Failed to load ethscriptions</p>';
}
})();
</script>
</body>
</html>`,
  },

  // ============================================
  // WALLET PORTFOLIO - Clean Light style
  // ============================================
  'wallet-clean-light': {
    id: 'wallet-clean-light',
    name: 'Wallet Portfolio (Clean Light)',
    type: 'wallet',
    version: '1.0',
    fields: ['wallet_address', 'display_name', 'view_mode'],
    css: `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#333;min-height:100vh}
.skip-link{position:absolute;top:-40px;left:0;background:#3b82f6;color:#fff;padding:8px 16px;z-index:100;text-decoration:none;font-weight:600}
.skip-link:focus{top:0}
main{max-width:1200px;margin:0 auto;padding:40px 20px;outline:none}
header{text-align:center;margin-bottom:2rem}
h1{font-size:2rem;color:#111;margin-bottom:0.5rem;font-weight:700}
.wallet{color:#666;font-family:monospace;font-size:0.9rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.feed{display:flex;flex-direction:column;gap:20px;max-width:600px;margin:0 auto}
.item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;transition:all 0.2s}
.item:hover{border-color:#3b82f6;box-shadow:0 4px 12px rgba(59,130,246,0.15)}
.item img{width:100%;aspect-ratio:1;object-fit:cover}
.feed .item img{aspect-ratio:auto;max-height:500px}
.item-info{padding:12px}
.item-id{color:#666;font-size:0.8rem;font-family:monospace}
a{color:#2563eb;text-decoration:none}
a:hover{text-decoration:underline}
a:focus{outline:2px solid #3b82f6;outline-offset:2px}
.loading{text-align:center;padding:40px;color:#666}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{display_name}} - Ethscriptions</title>
<meta name="description" content="Ethscriptions collection for {{display_name}}">
<style>{{css}}</style>
</head>
<body>
<a href="#main-content" class="skip-link">Skip to content</a>
<main id="main-content" role="main">
<header>
<h1 id="page-title">{{display_name}}</h1>
<p class="wallet">{{wallet_address}}</p>
</header>
<section aria-label="Ethscriptions collection" class="{{view_mode}}" id="collection">
<div class="loading">Loading ethscriptions...</div>
</section>
</main>
<script>
(async function(){
const wallet='{{wallet_address}}';
const container=document.getElementById('collection');
try{
const res=await fetch('https://api.ethscriptions.com/v2/ethscriptions?current_owner='+wallet+'&per_page=50');
const data=await res.json();
if(!data.result||data.result.length===0){
container.innerHTML='<p style="text-align:center;color:#666">No ethscriptions found</p>';
return;
}
container.innerHTML=data.result.map(e=>\`
<article class="item">
<a href="https://ethscriptions.com/ethscriptions/\${e.transaction_hash}" target="_blank" rel="noopener">
<img src="https://api.ethscriptions.com/v2/ethscriptions/\${e.transaction_hash}/content" alt="Ethscription \${e.transaction_hash.slice(0,10)}" loading="lazy">
<div class="item-info">
<p class="item-id">\${e.transaction_hash.slice(0,10)}...</p>
</div>
</a>
</article>
\`).join('');
}catch(err){
container.innerHTML='<p style="text-align:center;color:#f66">Failed to load ethscriptions</p>';
}
})();
</script>
</body>
</html>`,
  },

  // ============================================
  // WALLET PORTFOLIO - Retro Blogger style
  // ============================================
  'wallet-retro-blogger': {
    id: 'wallet-retro-blogger',
    name: 'Wallet Portfolio (Retro Blogger)',
    type: 'wallet',
    version: '1.0',
    fields: ['wallet_address', 'display_name', 'view_mode'],
    css: `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,'Times New Roman',serif;background:#f5f5dc;color:#333;min-height:100vh}
.skip-link{position:absolute;top:-40px;left:0;background:#2c3e50;color:#fff;padding:8px 16px;z-index:100;text-decoration:none}
.skip-link:focus{top:0}
.wrapper{max-width:1000px;margin:0 auto;background:#fff;border:1px solid #ccc;box-shadow:2px 2px 8px rgba(0,0,0,0.1)}
header{background:linear-gradient(to right,#2c3e50,#3498db);color:#fff;padding:30px;text-align:center}
h1{font-size:2rem;margin-bottom:0.5rem;text-shadow:1px 1px 2px rgba(0,0,0,0.3)}
.wallet{font-size:0.85rem;opacity:0.9;font-family:monospace}
main{padding:30px;outline:none}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px}
.feed{display:flex;flex-direction:column;gap:20px;max-width:600px;margin:0 auto}
.item{background:#f9f9f9;border:1px solid #ddd;border-radius:4px;overflow:hidden;transition:all 0.2s}
.item:hover{border-color:#3498db}
.item img{width:100%;aspect-ratio:1;object-fit:cover}
.feed .item img{aspect-ratio:auto;max-height:500px}
.item-info{padding:10px}
.item-id{color:#666;font-size:0.75rem;font-family:Verdana,sans-serif}
footer{background:#f0f0f0;padding:15px 30px;font-size:0.8rem;color:#666;text-align:center;border-top:1px solid #ddd}
a{color:#2980b9}
a:focus{outline:2px solid #3498db;outline-offset:2px}
.loading{text-align:center;padding:40px;color:#666}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{display_name}} - Ethscriptions</title>
<meta name="description" content="Ethscriptions collection for {{display_name}}">
<style>{{css}}</style>
</head>
<body>
<a href="#main-content" class="skip-link">Skip to content</a>
<div class="wrapper" role="document">
<header role="banner">
<h1 id="page-title">{{display_name}}</h1>
<p class="wallet">{{wallet_address}}</p>
</header>
<main id="main-content" role="main">
<section aria-label="Ethscriptions collection" class="{{view_mode}}" id="collection">
<div class="loading">Loading ethscriptions...</div>
</section>
</main>
<footer role="contentinfo">Powered by Chainhost - Permanent sites on the blockchain</footer>
</div>
<script>
(async function(){
const wallet='{{wallet_address}}';
const container=document.getElementById('collection');
try{
const res=await fetch('https://api.ethscriptions.com/v2/ethscriptions?current_owner='+wallet+'&per_page=50');
const data=await res.json();
if(!data.result||data.result.length===0){
container.innerHTML='<p style="text-align:center;color:#666">No ethscriptions found</p>';
return;
}
container.innerHTML=data.result.map(e=>\`
<article class="item">
<a href="https://ethscriptions.com/ethscriptions/\${e.transaction_hash}" target="_blank" rel="noopener">
<img src="https://api.ethscriptions.com/v2/ethscriptions/\${e.transaction_hash}/content" alt="Ethscription \${e.transaction_hash.slice(0,10)}" loading="lazy">
<div class="item-info">
<p class="item-id">\${e.transaction_hash.slice(0,10)}...</p>
</div>
</a>
</article>
\`).join('');
}catch(err){
container.innerHTML='<p style="text-align:center;color:#f66">Failed to load ethscriptions</p>';
}
})();
</script>
</body>
</html>`,
  },

  // ============================================
  // WALLET PORTFOLIO - Template Guide style
  // ============================================
  'wallet-template-guide': {
    id: 'wallet-template-guide',
    name: 'Wallet Portfolio (Template Guide)',
    type: 'wallet',
    version: '1.0',
    fields: ['wallet_address', 'display_name', 'view_mode'],
    css: `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;background:#0d1117;color:#c9d1d9;min-height:100vh}
.skip-link{position:absolute;top:-40px;left:0;background:#58a6ff;color:#0d1117;padding:8px 16px;z-index:100;text-decoration:none;font-weight:600}
.skip-link:focus{top:0}
main{max-width:1200px;margin:0 auto;padding:40px 20px;outline:none}
header{text-align:center;margin-bottom:2rem;border-bottom:1px solid #30363d;padding-bottom:1rem}
h1{font-size:2rem;color:#58a6ff;margin-bottom:0.5rem}
.wallet{color:#8b949e;font-size:0.9rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.feed{display:flex;flex-direction:column;gap:20px;max-width:600px;margin:0 auto}
.item{background:#161b22;border:1px solid #30363d;border-radius:8px;overflow:hidden;transition:all 0.2s}
.item:hover{border-color:#58a6ff}
.item img{width:100%;aspect-ratio:1;object-fit:cover}
.feed .item img{aspect-ratio:auto;max-height:500px}
.item-info{padding:12px}
.item-id{color:#8b949e;font-size:0.8rem}
a{color:#58a6ff;text-decoration:none}
a:hover{text-decoration:underline}
a:focus{outline:2px solid #58a6ff;outline-offset:2px}
.loading{text-align:center;padding:40px;color:#8b949e}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{display_name}} - Ethscriptions</title>
<meta name="description" content="Ethscriptions collection for {{display_name}}">
<style>{{css}}</style>
</head>
<body>
<a href="#main-content" class="skip-link">Skip to content</a>
<main id="main-content" role="main">
<header>
<h1 id="page-title">{{display_name}}</h1>
<p class="wallet">{{wallet_address}}</p>
</header>
<section aria-label="Ethscriptions collection" class="{{view_mode}}" id="collection">
<div class="loading">Loading ethscriptions...</div>
</section>
</main>
<script>
(async function(){
const wallet='{{wallet_address}}';
const container=document.getElementById('collection');
try{
const res=await fetch('https://api.ethscriptions.com/v2/ethscriptions?current_owner='+wallet+'&per_page=50');
const data=await res.json();
if(!data.result||data.result.length===0){
container.innerHTML='<p style="text-align:center;color:#8b949e">No ethscriptions found</p>';
return;
}
container.innerHTML=data.result.map(e=>\`
<article class="item">
<a href="https://ethscriptions.com/ethscriptions/\${e.transaction_hash}" target="_blank" rel="noopener">
<img src="https://api.ethscriptions.com/v2/ethscriptions/\${e.transaction_hash}/content" alt="Ethscription \${e.transaction_hash.slice(0,10)}" loading="lazy">
<div class="item-info">
<p class="item-id">\${e.transaction_hash.slice(0,10)}...</p>
</div>
</a>
</article>
\`).join('');
}catch(err){
container.innerHTML='<p style="text-align:center;color:#f66">Failed to load ethscriptions</p>';
}
})();
</script>
</body>
</html>`,
  },
};

// ============================================
// TEMPLATE RENDERING
// ============================================

// Render a template with data
export function renderTemplate(template: Template, data: Post): string {
  let html = template.html;

  // Replace CSS placeholder
  html = html.replace('{{css}}', template.css);

  // Replace simple placeholders
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), escapeHtml(value));
    }
  }

  // Handle keywords → tags
  if (data.keywords) {
    const keywordsHtml = data.keywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean)
      .map(k => `<span class="tag">${escapeHtml(k)}</span>`)
      .join('');
    html = html.replace('{{keywords_html}}', keywordsHtml);
    html = html.replace('{{#keywords}}', '').replace('{{/keywords}}', '');
  } else {
    // Remove keywords section if empty (use [\s\S] instead of . with /s flag for compatibility)
    html = html.replace(/{{#keywords}}[\s\S]*?{{\/keywords}}/g, '');
  }

  // Handle content → paragraphs
  if (data.content) {
    const contentHtml = data.content
      .split('\n\n')
      .map(p => `<p>${escapeHtml(p)}</p>`)
      .join('');
    html = html.replace('{{content_html}}', contentHtml);
  }

  // Handle links
  if (data.links && Array.isArray(data.links)) {
    const linksHtml = data.links
      .filter(l => l.label && l.url)
      .map(l => {
        const iconHtml = l.icon
          ? `<img class="icon" src="${getIconSrc(l.icon)}" alt="" width="32" height="32">`
          : '';
        return `<a class="link" href="${escapeHtml(l.url)}" target="_blank">${iconHtml}<span>${escapeHtml(l.label)}</span></a>`;
      })
      .join('\n');
    html = html.replace('{{links_html}}', linksHtml);
  }

  return html;
}

// Helper: resolve icon source (URL or tx hash)
function getIconSrc(icon: string): string {
  if (!icon) return '';
  if (icon.startsWith('0x') && icon.length === 66) {
    return `https://ethscriptions.com/ethscriptions/${icon}/content`;
  }
  return icon;
}

// Helper: escape HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================
// POST CREATION (MINIMAL CALLDATA)
// ============================================

// Create minimal post data (references template)
export function createPostData(templateRef: string, data: Omit<Post, 'ref'>): Post {
  return {
    ref: templateRef,
    ...data,
  };
}

// Convert post to inscription calldata
export function postToCalldata(post: Post): string {
  // Minimal JSON format
  const json = JSON.stringify(post);
  const dataUri = `data:application/json,${encodeURIComponent(json)}`;

  // Convert to hex
  const hex = Array.from(new TextEncoder().encode(dataUri))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `0x${hex}`;
}

// Convert template to inscription calldata
export function templateToCalldata(template: Template): string {
  const json = JSON.stringify({
    p: 'chainhost-template',
    ...template,
  });
  const dataUri = `data:application/json,${encodeURIComponent(json)}`;

  const hex = Array.from(new TextEncoder().encode(dataUri))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `0x${hex}`;
}

// ============================================
// SIZE COMPARISON
// ============================================

export function compareSize(fullHtml: string, post: Post): {
  fullSize: number;
  refSize: number;
  savings: number;
  savingsPercent: number;
} {
  const fullSize = new Blob([fullHtml]).size;
  const refSize = new Blob([JSON.stringify(post)]).size;
  const savings = fullSize - refSize;
  const savingsPercent = Math.round((savings / fullSize) * 100);

  return {
    fullSize,
    refSize,
    savings,
    savingsPercent,
  };
}
