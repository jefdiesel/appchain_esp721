"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import { inscribeWithUserWallet, setChain, type ChainOption } from "@/lib/wallet";
import { TEMPLATE_DEFINITIONS, renderTemplate, type Post } from "@/lib/templates";

// Banner image component that fetches from ethscriptions API
function BannerImage({ txHash, onClear, pixelArt }: { txHash: string; onClear: () => void; pixelArt: boolean }) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchImage() {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`https://api.ethscriptions.com/v2/ethscriptions/${txHash}`);
        const data = await res.json();
        if (data.result?.content_uri) {
          setImageSrc(data.result.content_uri);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchImage();
  }, [txHash]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-600 border-t-[#C3FF00] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !imageSrc) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
        <span className="text-red-400 text-sm">Failed to load image</span>
        <button onClick={onClear} className="text-xs text-gray-500 hover:text-white">
          Try another
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <img
        src={imageSrc}
        alt="Banner"
        className="w-full h-full object-cover"
        style={pixelArt ? { imageRendering: 'pixelated' } : {}}
      />
      <button
        onClick={onClear}
        className="absolute top-2 right-2 p-1 bg-black/50 rounded text-white text-xs hover:bg-black/80"
      >
        ✕
      </button>
    </div>
  );
}

type Step = "template" | "style" | "customize" | "review";

interface LinkItem {
  label: string;
  url: string;
  icon: string; // URL or tx hash for 32x32 icon
}

interface BlogPost {
  id?: string;
  title: string;
  content: string;
  keywords: string;
  txHash?: string; // Previous post inscription tx
  tx_hash?: string; // From API
  date?: string;
  created_at?: string;
}

// Shared theme styles for all template types
const sharedStyles = ["classic-degen", "clean-light", "retro-blogger", "template-guide"];
const linktreeStyles = ["classic-degen", "clean-light", "neon-fade"];

// Template categories with style options
const templateOptions: TemplateOption[] = [
  {
    id: "portfolio",
    name: "Portfolio",
    description: "Minimal single-page portfolio",
    category: "portfolio",
    fields: ["name", "tagline", "bio", "email"],
    styles: sharedStyles,
  },
  {
    id: "wallet",
    name: "Wallet Portfolio",
    description: "Display your ethscriptions collection",
    category: "wallet",
    fields: ["wallet_address", "display_name", "view_mode"],
    styles: sharedStyles,
  },
  {
    id: "links",
    name: "Link Tree",
    description: "Link-in-bio style page",
    category: "links",
    fields: ["name", "tagline", "links"],
    styles: sharedStyles,
  },
  {
    id: "linktree",
    name: "Social Linktree",
    description: "Social media links + collections",
    category: "linktree",
    fields: ["name", "tagline", "socials", "collections", "profileImage"],
    styles: linktreeStyles,
  },
  {
    id: "blog",
    name: "Blog Post",
    description: "Article with archive sidebar",
    category: "blog",
    fields: ["title", "author", "content", "keywords"],
    styles: sharedStyles,
  },
  {
    id: "custom",
    name: "Custom HTML",
    description: "Paste your own HTML",
    category: "custom",
    fields: ["html"],
    proOnly: true,
  },
];

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  category: string;
  fields: string[];
  styles?: string[];
  proOnly?: boolean;
}

// Style display info with full theme colors
const styleInfo: Record<string, {
  name: string;
  description: string;
  preview: string;
  bg: string;
  text: string;
  accent: string;
  border: string;
  inputBg: string;
  inputBorder: string;
}> = {
  "classic-degen": {
    name: "Classic Degen",
    description: "Black background, #C3FF00 accents",
    preview: "bg-black border-[#C3FF00]",
    bg: "bg-black",
    text: "text-white",
    accent: "text-[#C3FF00]",
    border: "border-[#C3FF00]",
    inputBg: "bg-zinc-900",
    inputBorder: "border-zinc-700 focus:border-[#C3FF00]",
  },
  "clean-light": {
    name: "Clean Light",
    description: "White background, blue accents",
    preview: "bg-white border-blue-500",
    bg: "bg-white",
    text: "text-gray-900",
    accent: "text-blue-600",
    border: "border-blue-500",
    inputBg: "bg-gray-50",
    inputBorder: "border-gray-300 focus:border-blue-500",
  },
  "retro-blogger": {
    name: "Retro Blogger",
    description: "2000s nostalgic blog vibes",
    preview: "bg-[#f5f5dc] border-[#2c3e50]",
    bg: "bg-[#f5f5dc]",
    text: "text-[#333]",
    accent: "text-[#2980b9]",
    border: "border-[#2c3e50]",
    inputBg: "bg-white",
    inputBorder: "border-[#ccc] focus:border-[#3498db]",
  },
  "template-guide": {
    name: "Developer",
    description: "GitHub dark, code-friendly",
    preview: "bg-[#0d1117] border-[#58a6ff]",
    bg: "bg-[#0d1117]",
    text: "text-[#c9d1d9]",
    accent: "text-[#58a6ff]",
    border: "border-[#58a6ff]",
    inputBg: "bg-[#161b22]",
    inputBorder: "border-[#30363d] focus:border-[#58a6ff]",
  },
  "portfolio-v1": {
    name: "Minimal Dark",
    description: "Black background, centered layout",
    preview: "bg-black border-[#C3FF00]",
    bg: "bg-black",
    text: "text-white",
    accent: "text-[#C3FF00]",
    border: "border-[#C3FF00]",
    inputBg: "bg-zinc-900",
    inputBorder: "border-zinc-700 focus:border-[#C3FF00]",
  },
  "links-v1": {
    name: "Link Tree",
    description: "Black background, hover effects",
    preview: "bg-black border-[#C3FF00]",
    bg: "bg-black",
    text: "text-white",
    accent: "text-[#C3FF00]",
    border: "border-[#C3FF00]",
    inputBg: "bg-zinc-900",
    inputBorder: "border-zinc-700 focus:border-[#C3FF00]",
  },
  "wallet-grid": {
    name: "Grid View",
    description: "Ethscriptions in a grid layout",
    preview: "bg-black border-[#C3FF00]",
    bg: "bg-black",
    text: "text-white",
    accent: "text-[#C3FF00]",
    border: "border-[#C3FF00]",
    inputBg: "bg-zinc-900",
    inputBorder: "border-zinc-700 focus:border-[#C3FF00]",
  },
  "wallet-feed": {
    name: "Feed View",
    description: "Ethscriptions in a scrolling feed",
    preview: "bg-zinc-950 border-purple-500",
    bg: "bg-zinc-950",
    text: "text-white",
    accent: "text-purple-400",
    border: "border-purple-500",
    inputBg: "bg-zinc-900",
    inputBorder: "border-zinc-700 focus:border-purple-500",
  },
  "neon-fade": {
    name: "Neon Fade",
    description: "Crazy animated gradient vibes",
    preview: "bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 border-cyan-400",
    bg: "bg-black",
    text: "text-white",
    accent: "text-cyan-400",
    border: "border-cyan-400",
    inputBg: "bg-zinc-900",
    inputBorder: "border-zinc-700 focus:border-cyan-400",
  },
};

// Template generators
function generateMinimalPortfolio(data: { name: string; tagline: string; bio: string; email: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${data.name}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .container{max-width:600px;padding:40px 20px;text-align:center}
    h1{font-size:3rem;margin-bottom:0.5rem}
    .tagline{color:#888;font-size:1.25rem;margin-bottom:2rem}
    .bio{color:#aaa;line-height:1.6;margin-bottom:2rem}
    .email{color:#C3FF00;text-decoration:none;font-size:1.1rem}
    .email:hover{text-decoration:underline}
  </style>
</head>
<body>
  <div class="container">
    <h1>${data.name}</h1>
    <p class="tagline">${data.tagline}</p>
    <p class="bio">${data.bio}</p>
    <a class="email" href="mailto:${data.email}">${data.email}</a>
  </div>
</body>
</html>`;
}

function generateLinkTree(data: { name: string; tagline: string; links: LinkItem[] }) {
  // Helper to resolve icon source (URL or tx hash)
  const getIconSrc = (icon: string) => {
    if (!icon) return "";
    if (icon.startsWith("0x") && icon.length === 66) {
      // Ethereum tx hash - will be loaded via ethscriptions
      return `https://ethscriptions.com/ethscriptions/${icon}/content`;
    }
    return icon; // Regular URL
  };

  const linksHtml = data.links
    .filter(l => l.label && l.url)
    .map(l => {
      const iconSrc = getIconSrc(l.icon);
      const iconHtml = iconSrc
        ? `<img class="icon" src="${iconSrc}" alt="" width="32" height="32">`
        : `<span class="icon-placeholder"></span>`;
      return `<a class="link" href="${l.url}" target="_blank">${iconHtml}<span>${l.label}</span></a>`;
    })
    .join("\n    ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${data.name}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .container{max-width:400px;width:100%;padding:40px 20px;text-align:center}
    h1{font-size:1.75rem;margin-bottom:0.5rem}
    .tagline{color:#888;margin-bottom:2rem}
    .links{display:flex;flex-direction:column;gap:12px}
    .link{display:flex;align-items:center;gap:12px;padding:12px 20px;background:#111;border:1px solid #333;border-radius:12px;color:#fff;text-decoration:none;transition:all 0.2s}
    .link:hover{background:#C3FF00;color:#000;border-color:#C3FF00}
    .icon{width:32px;height:32px;border-radius:6px;object-fit:cover;flex-shrink:0}
    .icon-placeholder{width:32px;height:32px;border-radius:6px;background:#222;flex-shrink:0}
  </style>
</head>
<body>
  <div class="container">
    <h1>${data.name}</h1>
    <p class="tagline">${data.tagline}</p>
    <div class="links">
    ${linksHtml}
    </div>
  </div>
</body>
</html>`;
}

function generateBlogPost(data: {
  title: string;
  author: string;
  content: string;
  keywords: string;
  image?: string;
  font?: "times" | "arial" | "mono";
  previousPosts: BlogPost[];
  username?: string;
  bannerTx?: string;
  bannerPixelArt?: boolean;
}) {
  // Resolve image source (URL or tx hash)
  const getImageSrc = (src: string) => {
    if (!src) return '';
    if (src.startsWith('0x') && src.length === 66) {
      return `https://ethscriptions.com/ethscriptions/${src}/content`;
    }
    return src;
  };

  // Font family mapping
  const fontFamilies: Record<string, string> = {
    times: "Georgia, 'Times New Roman', serif",
    arial: "Arial, Helvetica, sans-serif",
    mono: "'SF Mono', 'Fira Code', 'Consolas', monospace",
  };
  const fontFamily = fontFamilies[data.font || "times"];

  const headerImageHtml = data.image
    ? `<figure class="header-image"><img src="${getImageSrc(data.image)}" alt="Header image for ${data.title}"></figure>`
    : '';

  const keywordsHtml = data.keywords
    .split(',')
    .map(k => k.trim())
    .filter(Boolean)
    .map(k => `<span class="tag">${k}</span>`)
    .join('');

  const prevPostsHtml = data.previousPosts
    .filter(p => p.title && p.txHash)
    .map(p => {
      const postKeywords = p.keywords
        .split(',')
        .map(k => k.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map(k => `<span class="post-tag">${k}</span>`)
        .join('');
      return `<div class="prev-post">
        <a href="https://etherscan.io/tx/${p.txHash}" target="_blank" class="post-link">${p.title}</a>
        ${p.date ? `<span class="post-date">${p.date}</span>` : ''}
        <div class="post-tags">${postKeywords}</div>
      </div>`;
    })
    .join('');

  const hasPrevPosts = data.previousPosts.some(p => p.title && p.txHash);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${data.title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:${fontFamily};background:#000;color:#ddd;min-height:100vh}
    .layout{display:flex;min-height:100vh}
    .sidebar{width:280px;background:#0a0a0a;border-right:1px solid #222;padding:20px;position:fixed;left:0;top:0;bottom:0;transform:translateX(-100%);transition:transform 0.3s;z-index:100}
    .sidebar.open{transform:translateX(0)}
    .sidebar-toggle{position:fixed;left:20px;top:20px;z-index:101;background:#111;border:1px solid #333;color:#888;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:14px}
    .sidebar-toggle:hover{color:#C3FF00;border-color:#C3FF00}
    .sidebar h3{color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;font-family:system-ui,sans-serif}
    .prev-post{padding:12px 0;border-bottom:1px solid #222}
    .prev-post:last-child{border-bottom:none}
    .post-link{color:#C3FF00;text-decoration:none;font-size:14px;font-family:system-ui,sans-serif;display:block;margin-bottom:4px}
    .post-link:hover{text-decoration:underline}
    .post-date{color:#555;font-size:11px;font-family:system-ui,sans-serif}
    .post-tags{margin-top:6px}
    .post-tag{display:inline-block;background:#1a1a1a;color:#666;padding:2px 8px;border-radius:10px;font-size:10px;margin-right:4px;font-family:system-ui,sans-serif}
    .main{flex:1;padding:60px 20px;${hasPrevPosts ? 'margin-left:0' : ''}}
    article{max-width:650px;margin:0 auto}
    h1{font-size:2.5rem;color:#fff;margin-bottom:1rem;line-height:1.2}
    .meta{color:#888;margin-bottom:1rem;font-family:system-ui,sans-serif;font-size:0.9rem}
    .tags{margin-bottom:2rem}
    .tag{display:inline-block;background:#111;color:#C3FF00;padding:4px 12px;border-radius:20px;font-size:12px;margin-right:6px;font-family:system-ui,sans-serif}
    .header-image{margin-bottom:2rem}
    .header-image img{width:100%;max-height:400px;object-fit:cover;border-radius:8px}
    .content{font-size:1.2rem;line-height:1.8}
    .content p{margin-bottom:1.5rem}
    .no-posts{display:none}
    /* Comments (TIC Protocol) */
    .comments{max-width:650px;margin:4rem auto 0;padding-top:2rem;border-top:1px solid #222}
    .comments h2{font-family:system-ui,sans-serif;font-size:1.2rem;color:#fff;margin-bottom:1.5rem}
    .comment-form{margin-bottom:2rem}
    .comment-form textarea{width:100%;background:#111;border:1px solid #333;border-radius:8px;padding:12px;color:#fff;font-family:system-ui,sans-serif;font-size:14px;min-height:80px;resize:vertical}
    .comment-form textarea:focus{outline:none;border-color:#C3FF00}
    .comment-form button{margin-top:8px;background:#C3FF00;color:#000;border:none;padding:10px 20px;border-radius:6px;font-weight:600;cursor:pointer;font-family:system-ui,sans-serif}
    .comment-form button:hover{background:#d4ff4d}
    .comment-form button:disabled{opacity:0.5;cursor:not-allowed}
    .comments-list{display:flex;flex-direction:column;gap:16px}
    .comment{background:#0a0a0a;border:1px solid #222;border-radius:8px;padding:16px}
    .comment-header{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-family:system-ui,sans-serif;font-size:12px}
    .comment-author{color:#C3FF00;font-weight:500}
    .comment-time{color:#555}
    .comment-tx{color:#444;font-family:monospace;font-size:10px}
    .comment-tx:hover{color:#C3FF00}
    .comment-body{color:#aaa;font-size:14px;line-height:1.6}
    .no-comments{color:#555;font-family:system-ui,sans-serif;font-size:14px}
    .connect-prompt{color:#888;font-family:system-ui,sans-serif;font-size:14px;text-align:center;padding:20px;background:#0a0a0a;border-radius:8px}
    .connect-prompt button{background:#C3FF00;color:#000;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;margin-top:10px}
    @media(max-width:768px){.sidebar{width:260px}.main{margin-left:0}}
    /* Site header bar */
    .site-header{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;background:#000;border-bottom:1px solid #C3FF00}
    .site-header .logo{font-weight:700;font-size:18px;font-family:system-ui,sans-serif}
    .site-header .logo .user{color:#fff}
    .site-header .logo .dot,.site-header .logo .chain{color:#C3FF00}
    .site-header .logo .host{color:#fff}
    .site-header .signup{padding:8px 16px;border:1px solid #C3FF00;color:#C3FF00;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;font-family:system-ui,sans-serif}
    .site-header .signup:hover{background:#C3FF00;color:#000}
    .site-banner{width:100%;height:200px;overflow:hidden;background:#000}
    .site-banner img{width:100%;height:100%;object-fit:cover}
    .site-banner img.pixel-art{image-rendering:pixelated}
  </style>
</head>
<body>
  ${data.username ? `<header class="site-header">
    <span class="logo"><span class="user">${data.username}</span><span class="dot">.</span><span class="chain">chain</span><span class="host">host</span></span>
    <a href="https://chainhost.online" target="_blank" class="signup">Sign Up</a>
  </header>` : ''}
  ${data.bannerTx ? `<div class="site-banner" id="banner-container"></div>
  <script>
    fetch('https://api.ethscriptions.com/v2/ethscriptions/${data.bannerTx}')
      .then(r=>r.json())
      .then(d=>{
        if(d.result?.content_uri){
          document.getElementById('banner-container').innerHTML='<img src="'+d.result.content_uri+'" alt="Banner" class="${data.bannerPixelArt ? 'pixel-art' : ''}">';
        }
      }).catch(()=>{});
  </script>` : ''}
  <div class="layout">
    ${hasPrevPosts ? `
    <button class="sidebar-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open')">☰ Archive</button>
    <aside class="sidebar">
      <h3>Previous Posts</h3>
      ${prevPostsHtml}
    </aside>
    ` : ''}
    <main class="main">
      <article>
        <h1>${data.title}</h1>
        <p class="meta">by ${data.author}</p>
        ${keywordsHtml ? `<div class="tags">${keywordsHtml}</div>` : ''}
        ${headerImageHtml}
        <div class="content">${data.content.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}</div>
      </article>

      <!-- TIC Protocol Comments -->
      <section class="comments" id="comments">
        <h2>Comments</h2>

        <div id="comment-form-area">
          <div class="connect-prompt" id="connect-prompt">
            <p>Connect wallet to leave an onchain comment</p>
            <button onclick="connectWallet()">Connect Wallet</button>
          </div>
          <div class="comment-form" id="comment-form" style="display:none">
            <textarea id="comment-input" placeholder="Write a comment... (inscribed via TIC protocol)"></textarea>
            <button onclick="postComment()" id="post-btn">Post Comment</button>
          </div>
        </div>

        <div class="comments-list" id="comments-list">
          <p class="no-comments">No comments yet. Be the first to comment!</p>
        </div>
      </section>
    </main>
  </div>

  <script>
    // TIC Protocol Comments
    // Comments are inscribed onchain using the TIC protocol
    // Topic = this post's tx hash (set after inscription)

    let wallet = null;
    let postTxHash = null; // Will be set when viewing inscribed content

    // Try to get tx hash from URL or data attribute
    (function() {
      const params = new URLSearchParams(window.location.search);
      postTxHash = params.get('tx') || document.body.dataset.txHash || null;
      if (postTxHash) loadComments();
    })();

    async function connectWallet() {
      if (!window.ethereum) {
        alert('Please install MetaMask or another wallet');
        return;
      }
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        wallet = accounts[0];
        document.getElementById('connect-prompt').style.display = 'none';
        document.getElementById('comment-form').style.display = 'block';
      } catch (e) {
        console.error('Wallet connection failed:', e);
      }
    }

    async function postComment() {
      if (!wallet || !postTxHash) {
        alert('Please connect wallet and ensure this is an inscribed post');
        return;
      }

      const content = document.getElementById('comment-input').value.trim();
      if (!content) return;

      const btn = document.getElementById('post-btn');
      btn.disabled = true;
      btn.textContent = 'Inscribing...';

      try {
        // Create TIC comment
        const tic = {
          topic: postTxHash,
          content: content,
          version: '0x0',
          encoding: 'utf8',
          type: 'comment'
        };

        const dataUri = 'data:message/vnd.tic+json;rule=esip6,' + JSON.stringify(tic);
        const hex = '0x' + Array.from(new TextEncoder().encode(dataUri)).map(b => b.toString(16).padStart(2, '0')).join('');

        // Send transaction
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{
            from: wallet,
            to: wallet,
            data: hex,
            value: '0x0'
          }]
        });

        // Add to UI immediately
        addCommentToUI({
          author: wallet.slice(0, 6) + '...' + wallet.slice(-4),
          content: content,
          txHash: txHash,
          timestamp: Date.now()
        });

        document.getElementById('comment-input').value = '';
        alert('Comment inscribed! Tx: ' + txHash);
      } catch (e) {
        console.error('Comment failed:', e);
        alert('Failed to post comment: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Post Comment';
      }
    }

    function addCommentToUI(comment) {
      const list = document.getElementById('comments-list');
      const noComments = list.querySelector('.no-comments');
      if (noComments) noComments.remove();

      const div = document.createElement('div');
      div.className = 'comment';
      div.innerHTML = \`
        <div class="comment-header">
          <span class="comment-author">\${comment.author}</span>
          <span class="comment-time">\${new Date(comment.timestamp).toLocaleDateString()}</span>
          <a href="https://basescan.org/tx/\${comment.txHash}" target="_blank" class="comment-tx">\${comment.txHash.slice(0,10)}...</a>
        </div>
        <div class="comment-body">\${escapeHtml(comment.content)}</div>
      \`;
      list.prepend(div);
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    async function loadComments() {
      // TODO: Load comments from TIC indexer when available
      // For now, comments are stored client-side after posting
      // A full implementation would query: GET /api/tic/comments?topic={postTxHash}
    }
  </script>
</body>
</html>`;
}

// Social URL constructors
const SOCIAL_URLS: Record<string, (u: string) => string> = {
  twitter: (u) => `https://x.com/${u.replace('@', '')}`,
  instagram: (u) => `https://instagram.com/${u.replace('@', '')}`,
  linkedin: (u) => `https://linkedin.com/in/${u}`,
  github: (u) => `https://github.com/${u}`,
  tiktok: (u) => `https://tiktok.com/@${u.replace('@', '')}`,
  farcaster: (u) => `https://warpcast.com/${u}`,
  ens: (u) => `https://app.ens.domains/${u}`,
  opensea: (u) => `https://opensea.io/${u}`,
};

const SOCIAL_LABELS: Record<string, string> = {
  twitter: "Twitter / X",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  github: "GitHub",
  tiktok: "TikTok",
  farcaster: "Farcaster",
  ens: "ENS",
  opensea: "OpenSea",
};

const SOCIAL_ICONS: Record<string, string> = {
  twitter: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  instagram: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`,
  linkedin: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
  github: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>`,
  tiktok: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>`,
  farcaster: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.24 3H5.76A2.76 2.76 0 0 0 3 5.76v12.48A2.76 2.76 0 0 0 5.76 21h12.48A2.76 2.76 0 0 0 21 18.24V5.76A2.76 2.76 0 0 0 18.24 3zM8.4 17.4H6V9h2.4v8.4zm6-4.8h-4.8V9h4.8v3.6zm3.6 4.8h-2.4V9H18v8.4z"/></svg>`,
  ens: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6.27 7.73L12 2l5.73 5.73L12 13.46 6.27 7.73zM2 12l5.73-5.73L13.46 12l-5.73 5.73L2 12zm10 0l5.73-5.73L23.46 12l-5.73 5.73L12 12zm0 1.46l5.73 5.73L12 25l-5.73-5.81L12 13.46z"/></svg>`,
  opensea: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.374 0 12s5.374 12 12 12 12-5.374 12-12S18.629 0 12 0zM5.92 12.403l.051-.081 3.123-4.884a.107.107 0 0 1 .187.014c.52 1.169.972 2.623.76 3.528-.088.372-.335.876-.614 1.342a2.405 2.405 0 0 1-.117.199.106.106 0 0 1-.09.045H6.013a.106.106 0 0 1-.091-.163zm13.914 1.68a.109.109 0 0 1-.065.101c-.243.103-1.07.485-1.414.962-.878 1.222-1.548 2.97-3.048 2.97H9.053a4.019 4.019 0 0 1-4.013-4.028v-.072c0-.058.048-.106.108-.106h3.485c.07 0 .12.063.115.132-.026.226.017.459.125.67.206.42.636.682 1.099.682h1.726v-1.347H9.99a.11.11 0 0 1-.089-.173l.063-.09c.16-.231.391-.586.621-.992.156-.274.308-.566.43-.86.024-.052.043-.107.065-.16.033-.094.067-.182.091-.269a4.57 4.57 0 0 0 .065-.223c.057-.25.081-.514.081-.787 0-.108-.004-.221-.014-.327-.005-.117-.02-.235-.034-.352a3.415 3.415 0 0 0-.048-.312 6.494 6.494 0 0 0-.098-.468l-.014-.06c-.03-.108-.056-.21-.09-.317a11.824 11.824 0 0 0-.328-.972 5.212 5.212 0 0 0-.142-.355c-.072-.178-.146-.339-.213-.49a3.564 3.564 0 0 1-.094-.197 4.658 4.658 0 0 0-.103-.213c-.024-.053-.053-.104-.072-.152l-.211-.388c-.029-.053.019-.118.077-.101l1.32.357h.01l.173.05.192.054.07.019v-.783c0-.379.302-.686.679-.686a.66.66 0 0 1 .477.202.69.69 0 0 1 .2.484V6.65l.141.039c.01.005.022.01.031.017.034.024.084.062.147.11.05.038.103.086.165.137a10.351 10.351 0 0 1 .574.504c.214.199.454.432.684.691.065.074.127.146.192.226.062.079.132.156.19.232.079.104.16.212.235.324.033.053.074.108.105.161.096.142.178.288.257.435.034.067.067.141.096.213.089.197.159.396.202.598a.65.65 0 0 1 .029.132v.01c.014.057.019.12.024.184a2.057 2.057 0 0 1-.106.874c-.031.084-.06.17-.098.254-.075.17-.161.343-.264.502-.034.06-.075.122-.113.182-.043.063-.089.123-.127.18a3.823 3.823 0 0 1-.173.221c-.053.072-.106.144-.166.209-.081.098-.16.19-.245.278-.048.058-.1.118-.156.17-.052.06-.108.113-.156.161-.084.084-.15.147-.208.202l-.137.122a.102.102 0 0 1-.072.03h-1.051v1.346h1.322c.295 0 .576-.104.804-.298.077-.067.415-.36.816-.802a.094.094 0 0 1 .05-.03l3.65-1.057a.108.108 0 0 1 .138.103z"/></svg>`,
};

function generateLinktree(data: {
  name: string;
  tagline: string;
  profileImage: { src: string; pixelArt: boolean };
  socials: Record<string, { enabled: boolean; username: string }>;
  collections: Array<{ name: string; url: string; image: string; pixelArt: boolean }>;
  theme: string;
}) {
  // Helper to resolve image source (URL or tx hash)
  const getImageSrc = (src: string) => {
    if (!src) return "";
    if (src.startsWith("0x") && src.length === 66) {
      return `https://ethscriptions.com/ethscriptions/${src}/content`;
    }
    return src;
  };

  // Build social links HTML
  const socialLinksHtml = Object.entries(data.socials)
    .filter(([, s]) => s.enabled && s.username)
    .map(([key, s]) => {
      const url = SOCIAL_URLS[key](s.username);
      const icon = SOCIAL_ICONS[key];
      const label = SOCIAL_LABELS[key];
      return `<a class="social-link" href="${url}" target="_blank" rel="noopener">
        <span class="social-icon">${icon}</span>
        <span class="social-label">${label}</span>
        <span class="social-user">@${s.username.replace('@', '')}</span>
      </a>`;
    })
    .join("\n");

  // Build collections HTML
  const collectionsHtml = data.collections
    .filter(c => c.name && c.url)
    .map(c => {
      const imgSrc = getImageSrc(c.image);
      const pixelStyle = c.pixelArt ? ' style="image-rendering: pixelated"' : '';
      return `<a class="collection" href="${c.url}" target="_blank" rel="noopener">
        ${imgSrc ? `<img src="${imgSrc}" alt="${c.name}"${pixelStyle}>` : '<div class="collection-placeholder"></div>'}
        <span class="collection-name">${c.name}</span>
      </a>`;
    })
    .join("\n");

  // Profile image HTML
  const profileImgSrc = getImageSrc(data.profileImage.src);
  const profilePixelStyle = data.profileImage.pixelArt ? ' style="image-rendering: pixelated"' : '';
  const profileHtml = profileImgSrc
    ? `<img class="profile-img" src="${profileImgSrc}" alt="${data.name}"${profilePixelStyle}>`
    : `<div class="profile-placeholder"></div>`;

  // Theme-specific styles
  const themeStyles: Record<string, { bg: string; text: string; accent: string; card: string; hover: string }> = {
    "classic-degen": {
      bg: "#000",
      text: "#fff",
      accent: "#C3FF00",
      card: "#111",
      hover: "#C3FF00",
    },
    "clean-light": {
      bg: "#fff",
      text: "#333",
      accent: "#3b82f6",
      card: "#f8fafc",
      hover: "#3b82f6",
    },
    "neon-fade": {
      bg: "linear-gradient(135deg, #0f0f23 0%, #1a0a2e 50%, #0f1729 100%)",
      text: "#fff",
      accent: "#00ffff",
      card: "rgba(255,255,255,0.05)",
      hover: "#ff00ff",
    },
  };

  const theme = themeStyles[data.theme] || themeStyles["classic-degen"];
  const isNeonFade = data.theme === "neon-fade";
  const bgStyle = isNeonFade ? `background:${theme.bg}` : `background:${theme.bg}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${data.name}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;${bgStyle};color:${theme.text};min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    ${isNeonFade ? `
    @keyframes glow{0%,100%{filter:drop-shadow(0 0 8px #ff00ff)}50%{filter:drop-shadow(0 0 16px #00ffff)}}
    @keyframes borderGlow{0%,100%{border-color:#ff00ff}50%{border-color:#00ffff}}
    ` : ''}
    .container{max-width:420px;width:100%;text-align:center}
    .profile-img{width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid ${theme.accent};margin-bottom:1rem;${isNeonFade ? 'animation:glow 3s ease-in-out infinite' : ''}}
    .profile-placeholder{width:120px;height:120px;border-radius:50%;background:${theme.card};border:3px solid ${theme.accent};margin:0 auto 1rem}
    h1{font-size:1.75rem;margin-bottom:0.25rem;font-weight:700}
    .tagline{color:${theme.accent};opacity:0.8;margin-bottom:1.5rem}
    .socials{display:flex;flex-direction:column;gap:10px;margin-bottom:2rem}
    .social-link{display:flex;align-items:center;gap:12px;padding:14px 20px;background:${theme.card};border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:${theme.text};text-decoration:none;transition:all 0.2s;${isNeonFade ? 'animation:borderGlow 4s ease-in-out infinite' : ''}}
    .social-link:hover{background:${theme.hover};color:${data.theme === 'clean-light' ? '#fff' : '#000'};transform:translateY(-2px);${isNeonFade ? 'box-shadow:0 0 20px ' + theme.hover : ''}}
    .social-icon{width:24px;height:24px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .social-label{font-weight:600;flex:1;text-align:left}
    .social-user{opacity:0.6;font-size:0.9rem}
    .collections-title{font-size:0.85rem;text-transform:uppercase;letter-spacing:0.1em;opacity:0.5;margin-bottom:1rem}
    .collections{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:12px}
    .collection{display:flex;flex-direction:column;align-items:center;padding:12px;background:${theme.card};border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:${theme.text};text-decoration:none;transition:all 0.2s}
    .collection:hover{border-color:${theme.accent};transform:translateY(-2px)}
    .collection img{width:64px;height:64px;border-radius:8px;object-fit:cover;margin-bottom:8px}
    .collection-placeholder{width:64px;height:64px;border-radius:8px;background:rgba(255,255,255,0.1);margin-bottom:8px}
    .collection-name{font-size:0.85rem;font-weight:500;text-align:center}
  </style>
</head>
<body>
  <main class="container">
    ${profileHtml}
    <h1>${data.name}</h1>
    <p class="tagline">${data.tagline}</p>
    ${socialLinksHtml ? `<div class="socials">${socialLinksHtml}</div>` : ''}
    ${collectionsHtml ? `<p class="collections-title">Collections</p><div class="collections">${collectionsHtml}</div>` : ''}
  </main>
</body>
</html>`;
}

function BuilderContent() {
  const searchParams = useSearchParams();
  const initialStep = (searchParams.get("step") as Step) || "template";
  const [step, setStep] = useState<Step>(initialStep);

  useEffect(() => {
    const urlStep = searchParams.get("step") as Step;
    if (urlStep && ["template", "style", "customize", "domain", "review"].includes(urlStep)) {
      setStep(urlStep);
    }
  }, [searchParams]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [siteName, setSiteName] = useState("");
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [links, setLinks] = useState<LinkItem[]>([
    { label: "", url: "", icon: "" },
    { label: "", url: "", icon: "" },
    { label: "", url: "", icon: "" },
  ]);
  const [blogTitle, setBlogTitle] = useState("");
  const [blogAuthor, setBlogAuthor] = useState("");
  const [blogContent, setBlogContent] = useState("");
  const [blogKeywords, setBlogKeywords] = useState("");
  const [blogImage, setBlogImage] = useState(""); // URL or tx hash for header image
  const [blogFont, setBlogFont] = useState<"times" | "arial" | "mono">("times");
  // Wallet portfolio state
  const [walletAddress, setWalletAddress] = useState("");
  const [walletDisplayName, setWalletDisplayName] = useState("");
  const [walletViewMode, setWalletViewMode] = useState<"grid" | "feed">("grid");
  const [previousPosts, setPreviousPosts] = useState<BlogPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [savedPostId, setSavedPostId] = useState<string | null>(null);
  const [txHashInput, setTxHashInput] = useState("");
  const [isInscribing, setIsInscribing] = useState(false);
  const [inscriptionResult, setInscriptionResult] = useState<{
    success?: boolean;
    txHash?: string;
    explorerUrl?: string;
    error?: string;
    chain?: ChainOption;
  } | null>(null);
  const [selectedChain, setSelectedChain] = useState<ChainOption>("base");
  const [bannerTx, setBannerTx] = useState(""); // tx hash for 800x400 banner
  const [bannerPixelArt, setBannerPixelArt] = useState(false); // pixel art upscaling

  // Social Linktree state
  const [profileImage, setProfileImage] = useState({ src: "", pixelArt: false });
  const [socials, setSocials] = useState({
    twitter: { enabled: false, username: "" },
    instagram: { enabled: false, username: "" },
    linkedin: { enabled: false, username: "" },
    github: { enabled: false, username: "" },
    tiktok: { enabled: false, username: "" },
    farcaster: { enabled: false, username: "" },
    ens: { enabled: false, username: "" },
    opensea: { enabled: false, username: "" },
  });
  const [collections, setCollections] = useState<Array<{
    name: string;
    url: string;
    image: string;
    pixelArt: boolean;
  }>>([{ name: "", url: "", image: "", pixelArt: false }]);

  // Credits state
  const [credits, setCredits] = useState<{
    plan: string;
    creditsUsed: number;
    creditsRemaining: number;
    isPaid: boolean;
  } | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);

  // User data for subdomain display and site management
  const [username, setUsername] = useState<string | null>(null);
  const [userSites, setUserSites] = useState<Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
  }>>([]);
  const [selectedSiteSlug, setSelectedSiteSlug] = useState<string | null>(null);
  const [isPaidUser, setIsPaidUser] = useState(false);

  // Fetch user data on mount
  useEffect(() => {
    async function fetchUserData() {
      setLoadingCredits(true);
      try {
        // Fetch user info (includes credits, username, sites)
        const userRes = await fetch("/api/user");
        if (userRes.ok) {
          const userData = await userRes.json();
          setUsername(userData.username);
          setUserSites(userData.sites || []);
          setIsPaidUser(userData.isPaid || false);
          setCredits({
            plan: userData.plan,
            creditsUsed: userData.creditsUsed,
            creditsRemaining: userData.isPaid ? -1 : Math.max(0, 5 - userData.creditsUsed),
            isPaid: userData.isPaid,
          });

          // Default to creating a new slug based on username
          if (userData.username && !selectedSiteSlug) {
            setSelectedSiteSlug(userData.username);
          }
        }
      } catch (err) {
        console.error("Failed to fetch user data:", err);
      } finally {
        setLoadingCredits(false);
      }
    }
    fetchUserData();
  }, []);

  // Get current theme based on selected style
  const currentTheme = selectedStyle ? styleInfo[selectedStyle] : null;


  // Load previous blog posts when blog template is selected
  useEffect(() => {
    if (selectedTemplate === "blog") {
      setLoadingPosts(true);
      fetch("/api/blog")
        .then(res => res.json())
        .then(data => {
          if (data.posts && data.posts.length > 0) {
            // Convert API format to local format
            const posts = data.posts.map((p: BlogPost) => ({
              id: p.id,
              title: p.title,
              content: p.content || "",
              keywords: p.keywords || "",
              txHash: p.tx_hash || "",
              date: p.created_at ? new Date(p.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "",
            }));
            setPreviousPosts(posts);
          }
        })
        .catch(err => console.error("Failed to load posts:", err))
        .finally(() => setLoadingPosts(false));
    }
  }, [selectedTemplate]);
  const [customHtml, setCustomHtml] = useState("");
  const [generatedHtml, setGeneratedHtml] = useState("");

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-12 flex-wrap">
          {(["template", "style", "customize", "review"] as Step[]).map(
            (s, i) => {
              const stepLabels = ["Type", "Style", "Content", "Review"];
              const isActive = step === s;
              const isPast = ["template", "style", "customize", "review"].indexOf(step) > i;
              return (
                <div key={s} className="flex items-center gap-2">
                  <button
                    onClick={() => setStep(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      isActive
                        ? "bg-[#C3FF00] text-black"
                        : isPast
                        ? "bg-zinc-700 text-white"
                        : "bg-zinc-800 text-gray-500"
                    }`}
                  >
                    {stepLabels[i]}
                  </button>
                  {i < 3 && <div className="w-4 h-px bg-zinc-800" />}
                </div>
              );
            }
          )}
        </div>

        {/* Step Content */}
        {step === "template" && (
          <div>
            <h1 className="text-3xl font-bold text-white text-center mb-2">
              What do you want to create?
            </h1>
            <p className="text-gray-500 text-center mb-8">
              Choose a template type to get started
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {templateOptions.map((template) => {
                const isLocked = template.proOnly && !isPaidUser;
                return (
                  <button
                    key={template.id}
                    onClick={() => {
                      if (isLocked) {
                        window.location.href = "/upgrade";
                        return;
                      }
                      setSelectedTemplate(template.id);
                      // Skip style step if only one style or custom
                      if (template.id === "custom" || !template.styles || template.styles.length <= 1) {
                        setSelectedStyle(template.styles?.[0] || null);
                        setStep("customize");
                      } else {
                        setStep("style");
                      }
                    }}
                    className={`p-6 border rounded-xl text-left transition relative ${
                      isLocked
                        ? "border-zinc-800 opacity-60"
                        : selectedTemplate === template.id
                        ? "border-[#C3FF00] bg-zinc-900"
                        : "border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-semibold">
                        {template.name}
                      </h3>
                      {template.proOnly && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded font-medium">
                          PRO
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{template.description}</p>
                    {isLocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                        <span className="text-xs text-gray-400">Upgrade to unlock</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-4 mt-8">
              <Link
                href="/dashboard"
                className="px-6 py-3 border border-zinc-700 rounded-lg hover:border-zinc-500 transition"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Style Selection Step */}
        {step === "style" && (
          <div>
            <h1 className="text-3xl font-bold text-white text-center mb-2">
              Choose a style
            </h1>
            <p className="text-gray-500 text-center mb-8">
              Pick a visual style for your {selectedTemplate}
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {templateOptions
                .find(t => t.id === selectedTemplate)
                ?.styles?.map((styleId) => {
                  const style = styleInfo[styleId];
                  return (
                    <button
                      key={styleId}
                      onClick={() => {
                        setSelectedStyle(styleId);
                        setStep("customize");
                      }}
                      className={`p-6 border-2 rounded-xl text-left transition ${
                        selectedStyle === styleId
                          ? "border-[#C3FF00] bg-zinc-900"
                          : "border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className={`w-full h-20 rounded-lg mb-4 border-2 ${style?.preview || "bg-zinc-800 border-zinc-700"}`} />
                      <h3 className="text-white font-semibold mb-1">
                        {style?.name || styleId}
                      </h3>
                      <p className="text-sm text-gray-500">{style?.description}</p>
                    </button>
                  );
                })}
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setStep("template")}
                className="px-6 py-3 border border-zinc-700 rounded-lg hover:border-zinc-500 transition"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === "customize" && (
          <div className={`rounded-2xl transition-colors ${currentTheme ? currentTheme.bg : ''} ${currentTheme ? 'p-8' : ''}`}>
            {/* Subdomain Header with Site Selector */}
            <div className="text-center mb-8">
              <div className={`inline-flex items-center gap-1 px-4 py-2 rounded-full border ${currentTheme ? currentTheme.border : 'border-[#C3FF00]'} bg-black/20`}>
                {isPaidUser && userSites.length > 0 ? (
                  // Paid users can select/create multiple sites
                  <select
                    value={selectedSiteSlug || username || ''}
                    onChange={(e) => setSelectedSiteSlug(e.target.value)}
                    className={`bg-transparent font-mono text-lg ${currentTheme ? currentTheme.accent : 'text-[#C3FF00]'} focus:outline-none cursor-pointer`}
                  >
                    <option value={username || ''}>{username} (main)</option>
                    {userSites.filter(s => s.slug !== username).map(site => (
                      <option key={site.id} value={site.slug}>{site.slug}</option>
                    ))}
                    <option value="__new__">+ New site</option>
                  </select>
                ) : (
                  <span className={`font-mono text-lg ${currentTheme ? currentTheme.accent : 'text-[#C3FF00]'}`}>
                    {username || 'loading...'}
                  </span>
                )}
                <span className={`text-sm opacity-60 ${currentTheme ? currentTheme.text : 'text-white'}`}>.chainhost.online</span>
              </div>
              {isPaidUser && (
                <p className={`text-xs mt-2 opacity-50 ${currentTheme ? currentTheme.text : 'text-gray-500'}`}>
                  Paid users can create multiple sites
                </p>
              )}
            </div>

            <h1 className={`text-3xl font-bold text-center mb-2 ${currentTheme ? currentTheme.text : 'text-white'}`}>
              {selectedTemplate === "blog" ? (blogTitle || "Your Post Title") : "Customize your site"}
            </h1>
            <p className={`text-center mb-8 ${currentTheme ? 'opacity-60 ' + currentTheme.text : 'text-gray-500'}`}>
              {selectedTemplate === "custom"
                ? "Paste your HTML below"
                : selectedTemplate === "blog"
                ? ""
                : "Fill in the details"}
            </p>

            {/* Custom HTML */}
            {selectedTemplate === "custom" && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  HTML Content
                </label>
                <textarea
                  value={customHtml}
                  onChange={(e) => setCustomHtml(e.target.value)}
                  className="w-full h-96 bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-sm text-gray-300 focus:border-[#C3FF00] focus:outline-none"
                  placeholder="<!DOCTYPE html>
<html>
<head>
  <title>My Site</title>
</head>
<body>
  <h1>Hello World</h1>
</body>
</html>"
                />
                <div className="text-sm text-gray-500 mt-2">
                  {customHtml.length} characters |{" "}
                  {new Blob([customHtml]).size} bytes
                </div>
              </div>
            )}

            {/* Portfolio */}
            {selectedTemplate === "portfolio" && (
              <div className="space-y-6">
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Your Name</label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Tagline</label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                    placeholder="Designer & Developer"
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className={`w-full h-32 rounded-xl p-4 focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                    placeholder="A short description about yourself..."
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                    placeholder="hello@example.com"
                  />
                </div>
              </div>
            )}

            {/* Wallet Portfolio */}
            {selectedTemplate === "wallet" && (
              <div className="space-y-6">
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>
                    Wallet Address
                  </label>
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 font-mono focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                    placeholder="0x..."
                  />
                  <p className={`text-xs mt-2 ${currentTheme ? 'opacity-50 ' + currentTheme.text : 'text-gray-600'}`}>
                    Your Ethereum wallet address to display ethscriptions from
                  </p>
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>
                    Display Name (optional)
                  </label>
                  <input
                    type="text"
                    value={walletDisplayName}
                    onChange={(e) => setWalletDisplayName(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                    placeholder="My Collection"
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>
                    View Mode
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setWalletViewMode("grid")}
                      className={`flex-1 py-3 px-4 rounded-xl border transition ${
                        walletViewMode === "grid"
                          ? currentTheme ? currentTheme.border + ' ' + currentTheme.bg : 'border-[#C3FF00] bg-zinc-900'
                          : 'border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <div className={`text-center ${currentTheme ? currentTheme.text : 'text-white'}`}>
                        <div className="text-2xl mb-1">&#9638;</div>
                        <div className="text-sm font-medium">Grid</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWalletViewMode("feed")}
                      className={`flex-1 py-3 px-4 rounded-xl border transition ${
                        walletViewMode === "feed"
                          ? currentTheme ? currentTheme.border + ' ' + currentTheme.bg : 'border-[#C3FF00] bg-zinc-900'
                          : 'border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <div className={`text-center ${currentTheme ? currentTheme.text : 'text-white'}`}>
                        <div className="text-2xl mb-1">&#9776;</div>
                        <div className="text-sm font-medium">Feed</div>
                      </div>
                    </button>
                  </div>
                </div>
                <div className={`p-4 rounded-xl ${currentTheme ? currentTheme.inputBg : 'bg-zinc-900'} border border-zinc-800`}>
                  <p className={`text-sm ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>
                    Your wallet portfolio will automatically fetch and display all ethscriptions owned by this address.
                    The page updates dynamically as your collection changes.
                  </p>
                </div>
              </div>
            )}

            {/* Link Tree */}
            {selectedTemplate === "links" && (
              <div className="space-y-6">
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Your Name</label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                    placeholder="@username"
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Tagline</label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                    placeholder="Creator | Builder | Dreamer"
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Links</label>
                  <div className="space-y-4">
                    {links.map((link, i) => (
                      <div key={i} className={`p-4 rounded-xl space-y-3 ${currentTheme ? currentTheme.inputBg + '/50 border border-zinc-700' : 'bg-zinc-900/50 border border-zinc-800'}`}>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={link.label}
                            onChange={(e) => {
                              const newLinks = [...links];
                              newLinks[i].label = e.target.value;
                              setLinks(newLinks);
                            }}
                            className={`flex-1 rounded-lg px-4 py-2 focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                            placeholder="Label (e.g. Twitter)"
                          />
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => {
                              const newLinks = [...links];
                              newLinks[i].url = e.target.value;
                              setLinks(newLinks);
                            }}
                            className={`flex-1 rounded-lg px-4 py-2 focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                            placeholder="https://..."
                          />
                        </div>
                        <input
                          type="text"
                          value={link.icon}
                          onChange={(e) => {
                            const newLinks = [...links];
                            newLinks[i].icon = e.target.value;
                            setLinks(newLinks);
                          }}
                          className={`w-full rounded-lg px-4 py-2 text-sm font-mono focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                          placeholder="Icon: URL or tx hash (0x...)"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setLinks([...links, { label: "", url: "", icon: "" }])}
                    className={`mt-3 text-sm hover:underline ${currentTheme ? currentTheme.accent : 'text-[#C3FF00]'}`}
                  >
                    + Add another link
                  </button>
                </div>
              </div>
            )}

            {/* Social Linktree */}
            {selectedTemplate === "linktree" && (
              <div className="space-y-6">
                {/* Profile Image */}
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Profile Image</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={profileImage.src}
                      onChange={(e) => setProfileImage({ ...profileImage, src: e.target.value })}
                      className={`flex-1 rounded-xl px-4 py-3 font-mono text-sm focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                      placeholder="0x... or https://..."
                    />
                    <label className={`flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder : 'bg-zinc-900 border border-zinc-800'}`}>
                      <input
                        type="checkbox"
                        checked={profileImage.pixelArt}
                        onChange={(e) => setProfileImage({ ...profileImage, pixelArt: e.target.checked })}
                        className="w-4 h-4 accent-[#C3FF00]"
                      />
                      <span className={`text-sm ${currentTheme ? currentTheme.text : 'text-white'}`}>Pixel</span>
                    </label>
                  </div>
                </div>

                {/* Name & Tagline */}
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Display Name</label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                    placeholder="Your name or handle"
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Tagline</label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                    placeholder="Creator | Builder | Collector"
                  />
                </div>

                {/* Social Links */}
                <div>
                  <label className={`block text-sm mb-3 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Social Links</label>
                  <div className="space-y-3">
                    {(Object.keys(socials) as Array<keyof typeof socials>).map((key) => (
                      <div key={key} className={`flex items-center gap-3 p-3 rounded-xl ${currentTheme ? currentTheme.inputBg + '/50 border border-zinc-700' : 'bg-zinc-900/50 border border-zinc-800'}`}>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={socials[key].enabled}
                            onChange={(e) => setSocials({
                              ...socials,
                              [key]: { ...socials[key], enabled: e.target.checked }
                            })}
                            className="w-4 h-4 accent-[#C3FF00]"
                          />
                          <span className={`w-24 text-sm font-medium ${currentTheme ? currentTheme.text : 'text-white'}`}>
                            {SOCIAL_LABELS[key]}
                          </span>
                        </label>
                        <input
                          type="text"
                          value={socials[key].username}
                          onChange={(e) => setSocials({
                            ...socials,
                            [key]: { ...socials[key], username: e.target.value, enabled: true }
                          })}
                          disabled={!socials[key].enabled && !socials[key].username}
                          className={`flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'} disabled:opacity-50`}
                          placeholder={key === 'ens' ? 'name.eth' : key === 'linkedin' ? 'username' : '@username'}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Collections */}
                <div>
                  <label className={`block text-sm mb-3 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Collections</label>
                  <div className="space-y-4">
                    {collections.map((col, i) => (
                      <div key={i} className={`p-4 rounded-xl space-y-3 ${currentTheme ? currentTheme.inputBg + '/50 border border-zinc-700' : 'bg-zinc-900/50 border border-zinc-800'}`}>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={col.name}
                            onChange={(e) => {
                              const newCols = [...collections];
                              newCols[i].name = e.target.value;
                              setCollections(newCols);
                            }}
                            className={`flex-1 rounded-lg px-4 py-2 focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                            placeholder="Collection name"
                          />
                          {collections.length > 1 && (
                            <button
                              onClick={() => setCollections(collections.filter((_, idx) => idx !== i))}
                              className="px-3 py-2 text-red-400 hover:text-red-300 transition"
                            >
                              &times;
                            </button>
                          )}
                        </div>
                        <input
                          type="url"
                          value={col.url}
                          onChange={(e) => {
                            const newCols = [...collections];
                            newCols[i].url = e.target.value;
                            setCollections(newCols);
                          }}
                          className={`w-full rounded-lg px-4 py-2 focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                          placeholder="https://opensea.io/collection/..."
                        />
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={col.image}
                            onChange={(e) => {
                              const newCols = [...collections];
                              newCols[i].image = e.target.value;
                              setCollections(newCols);
                            }}
                            className={`flex-1 rounded-lg px-4 py-2 text-sm font-mono focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                            placeholder="Image: 0x... or URL"
                          />
                          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder : 'bg-zinc-900 border border-zinc-800'}`}>
                            <input
                              type="checkbox"
                              checked={col.pixelArt}
                              onChange={(e) => {
                                const newCols = [...collections];
                                newCols[i].pixelArt = e.target.checked;
                                setCollections(newCols);
                              }}
                              className="w-4 h-4 accent-[#C3FF00]"
                            />
                            <span className={`text-sm ${currentTheme ? currentTheme.text : 'text-white'}`}>Pixel</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setCollections([...collections, { name: "", url: "", image: "", pixelArt: false }])}
                    className={`mt-3 text-sm hover:underline ${currentTheme ? currentTheme.accent : 'text-[#C3FF00]'}`}
                  >
                    + Add collection
                  </button>
                </div>
              </div>
            )}

            {/* Blog Post */}
            {selectedTemplate === "blog" && (
              <div className="space-y-6">
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Title</label>
                  <input
                    type="text"
                    value={blogTitle}
                    onChange={(e) => setBlogTitle(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                    placeholder={["What's happening now?", "Post this forever", "Got something to say?", "Make it permanent", "Write it onchain", "Say it once, keep it forever"][Math.floor(Math.random() * 6)]}
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Content</label>
                  <div className={`rounded-xl overflow-hidden ${currentTheme ? 'border ' + currentTheme.inputBorder : 'border border-zinc-800'}`}>
                    <div className={`flex items-center gap-1 px-3 py-2 border-b ${currentTheme ? currentTheme.inputBg + ' ' + currentTheme.inputBorder : 'bg-zinc-900 border-zinc-800'}`}>
                      <span className={`text-xs mr-2 ${currentTheme ? 'opacity-50 ' + currentTheme.text : 'text-gray-500'}`}>Font:</span>
                      {[
                        { id: "times", name: "Aa", style: "font-serif" },
                        { id: "arial", name: "Aa", style: "font-sans" },
                        { id: "mono", name: "Aa", style: "font-mono" },
                      ].map((font, i) => (
                        <button
                          key={font.id}
                          type="button"
                          onClick={() => setBlogFont(font.id as "times" | "arial" | "mono")}
                          title={font.id.charAt(0).toUpperCase() + font.id.slice(1)}
                          className={`px-2 py-1 text-sm rounded transition ${font.style} ${
                            blogFont === font.id
                              ? currentTheme ? currentTheme.accent + ' ' + currentTheme.bg : 'text-[#C3FF00] bg-zinc-800'
                              : currentTheme ? 'opacity-50 ' + currentTheme.text + ' hover:opacity-100' : 'text-gray-500 hover:text-white'
                          }`}
                        >
                          {font.name}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={blogContent}
                      onChange={(e) => setBlogContent(e.target.value)}
                      className={`w-full h-64 p-4 focus:outline-none resize-none ${
                        blogFont === "times" ? "font-serif" : blogFont === "mono" ? "font-mono" : "font-sans"
                      } ${currentTheme ? currentTheme.inputBg + ' ' + currentTheme.text : 'bg-zinc-900 text-white'}`}
                      placeholder="Write your blog post here..."
                    />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Keywords</label>
                  <input
                    type="text"
                    value={blogKeywords}
                    onChange={(e) => setBlogKeywords(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                    placeholder="ethereum, web3, decentralized (comma separated)"
                  />
                </div>

                {/* Site Banner */}
                <div>
                  <label className={`block text-sm mb-2 ${currentTheme ? 'opacity-70 ' + currentTheme.text : 'text-gray-400'}`}>Site Banner (optional)</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={bannerTx}
                      onChange={(e) => setBannerTx(e.target.value)}
                      className={`flex-1 rounded-xl px-4 py-3 font-mono text-sm focus:outline-none ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder + ' ' + currentTheme.text : 'bg-zinc-900 border border-zinc-800 text-white focus:border-[#C3FF00]'}`}
                      placeholder="0x... (ethscription tx hash)"
                    />
                    <label className={`flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer ${currentTheme ? currentTheme.inputBg + ' border ' + currentTheme.inputBorder : 'bg-zinc-900 border border-zinc-800'}`}>
                      <input
                        type="checkbox"
                        checked={bannerPixelArt}
                        onChange={(e) => setBannerPixelArt(e.target.checked)}
                        className="w-4 h-4 accent-[#C3FF00]"
                      />
                      <span className={`text-sm ${currentTheme ? currentTheme.text : 'text-white'}`}>Pixel art</span>
                    </label>
                  </div>
                  <p className={`text-xs mt-1 ${currentTheme ? 'opacity-50 ' + currentTheme.text : 'text-gray-600'}`}>
                    800x200 banner image tx hash. Enable &quot;Pixel art&quot; for crisp upscaling.
                  </p>
                </div>

                {/* Previous Posts Section */}
                <div className="border-t border-zinc-800 pt-6">
                  <label className="block text-sm text-gray-400 mb-4">
                    Previous Posts {loadingPosts && <span className="text-gray-600">(loading...)</span>}
                  </label>

                  {previousPosts.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {previousPosts.filter(p => p.txHash).map((post, i) => (
                        <div key={i} className="p-3 bg-zinc-900/30 border border-zinc-800 rounded-lg flex items-center justify-between">
                          <div>
                            <span className="text-white text-sm">{post.title}</span>
                            <span className="text-gray-600 text-xs ml-2">{post.date}</span>
                            {post.keywords && (
                              <div className="text-gray-500 text-xs mt-1">
                                {post.keywords.split(",").slice(0, 3).map(k => k.trim()).join(", ")}
                              </div>
                            )}
                          </div>
                          <a
                            href={`https://etherscan.io/tx/${post.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#C3FF00] text-xs font-mono hover:underline"
                          >
                            {post.txHash?.slice(0, 10)}...
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 text-sm mb-4">
                      {loadingPosts ? "Loading your posts..." : "No previous posts yet. This will be your first!"}
                    </p>
                  )}

                  <p className="text-gray-500 text-xs">
                    Your inscribed posts will automatically appear in the archive sidebar.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => {
                  const template = templateOptions.find(t => t.id === selectedTemplate);
                  // Go back to style if multiple styles exist, otherwise template
                  if (template?.styles && template.styles.length > 1) {
                    setStep("style");
                  } else {
                    setStep("template");
                  }
                }}
                className={`px-6 py-3 border rounded-lg transition ${currentTheme ? currentTheme.border + ' hover:opacity-80 ' + currentTheme.text : 'border-zinc-700 hover:border-zinc-500'}`}
              >
                Back
              </button>
              <button
                onClick={() => {
                  // Generate HTML based on template and style
                  let html = "";

                  if (selectedTemplate === "custom") {
                    html = customHtml;
                  } else if (selectedTemplate === "wallet" && selectedStyle) {
                    // Wallet templates use format: wallet-{style}
                    const walletTemplateId = `wallet-${selectedStyle}`;
                    const template = TEMPLATE_DEFINITIONS[walletTemplateId];
                    if (template) {
                      // Replace placeholders directly in template HTML
                      html = template.html
                        .replace('{{css}}', template.css)
                        .replace(/\{\{wallet_address\}\}/g, walletAddress)
                        .replace(/\{\{display_name\}\}/g, walletDisplayName || walletAddress.slice(0, 10) + '...')
                        .replace(/\{\{view_mode\}\}/g, walletViewMode);
                    }
                  } else if (selectedStyle && TEMPLATE_DEFINITIONS[selectedStyle]) {
                    // Use the accessible template from templates.ts
                    const template = TEMPLATE_DEFINITIONS[selectedStyle];
                    const postData: Post = { ref: selectedStyle };

                    if (selectedTemplate === "portfolio") {
                      postData.name = siteName;
                      postData.tagline = tagline;
                      postData.bio = bio;
                      postData.email = email;
                    } else if (selectedTemplate === "links") {
                      postData.name = siteName;
                      postData.tagline = tagline;
                      postData.links = links.filter(l => l.label && l.url);
                    } else if (selectedTemplate === "blog") {
                      postData.title = blogTitle;
                      postData.author = username || "";
                      postData.content = blogContent;
                      postData.keywords = blogKeywords;
                    }

                    html = renderTemplate(template, postData);
                  } else {
                    // Fallback to old generators
                    if (selectedTemplate === "portfolio") {
                      html = generateMinimalPortfolio({ name: siteName, tagline, bio, email });
                    } else if (selectedTemplate === "links") {
                      html = generateLinkTree({ name: siteName, tagline, links });
                    } else if (selectedTemplate === "blog") {
                      html = generateBlogPost({
                        title: blogTitle,
                        author: username || "",
                        content: blogContent,
                        keywords: blogKeywords,
                        image: blogImage,
                        font: blogFont,
                        previousPosts: previousPosts,
                        username: username || "",
                        bannerTx: bannerTx,
                        bannerPixelArt: bannerPixelArt,
                      });
                    } else if (selectedTemplate === "linktree") {
                      html = generateLinktree({
                        name: siteName,
                        tagline,
                        profileImage,
                        socials,
                        collections,
                        theme: selectedStyle || "classic-degen",
                      });
                    }
                  }

                  setGeneratedHtml(html);
                  setStep("review");
                }}
                className={`flex-1 px-6 py-3 font-semibold rounded-lg transition ${
                  currentTheme
                    ? currentTheme.border + ' border-2 ' + currentTheme.accent + ' bg-transparent hover:opacity-80'
                    : 'bg-[#C3FF00] text-black hover:bg-[#d4ff4d]'
                }`}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div>
            {/* User Banner Bar */}
            <div className="max-w-[800px] mx-auto mb-8 border rounded-xl overflow-hidden" style={{ borderColor: currentTheme?.border?.includes('#') ? currentTheme.border.match(/#[A-Fa-f0-9]+/)?.[0] : '#C3FF00' }}>
              <div className={`flex items-center justify-between p-4 ${currentTheme?.bg || 'bg-black'}`}>
                <span className={`font-bold text-lg`}>
                  <span className={currentTheme?.text || 'text-white'}>{username || 'user'}</span>
                  <span className={currentTheme?.accent || 'text-[#C3FF00]'}>.</span>
                  <span className={currentTheme?.accent || 'text-[#C3FF00]'}>chain</span>
                  <span className={currentTheme?.text || 'text-white'}>host</span>
                </span>
                <a
                  href="https://chainhost.online"
                  target="_blank"
                  className={`px-4 py-2 rounded-lg font-semibold text-sm ${currentTheme?.accent || 'text-[#C3FF00]'} border ${currentTheme?.border || 'border-[#C3FF00]'} hover:opacity-80 transition`}
                >
                  Sign Up
                </a>
              </div>
              {/* Banner Preview */}
              <div className={`h-[200px] overflow-hidden ${currentTheme?.bg || 'bg-black'} relative`}>
                {bannerTx && bannerTx.startsWith('0x') ? (
                  <BannerImage txHash={bannerTx} onClear={() => setBannerTx('')} pixelArt={bannerPixelArt} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <input
                      type="text"
                      value={bannerTx}
                      onChange={(e) => setBannerTx(e.target.value)}
                      placeholder="Paste banner tx hash (0x...)"
                      className={`w-64 px-3 py-2 rounded-lg text-sm font-mono text-center ${currentTheme?.inputBg || 'bg-zinc-900'} border ${currentTheme?.inputBorder || 'border-zinc-700'} ${currentTheme?.text || 'text-white'} focus:outline-none`}
                    />
                  </div>
                )}
              </div>
              {/* Post Preview */}
              <div className="bg-white">
                {(generatedHtml || customHtml) ? (
                  <iframe
                    srcDoc={generatedHtml || customHtml}
                    className="w-full h-[400px] border-0"
                    title="Site preview"
                  />
                ) : (
                  <div className="w-full h-[400px] flex items-center justify-center text-gray-500">
                    No content to preview
                  </div>
                )}
              </div>
            </div>


            {/* Credits Status */}
            {credits && (
              <div className="border border-zinc-800 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-semibold mb-1">Credits</h3>
                    <p className="text-sm text-gray-500">
                      {credits.isPaid ? (
                        <span className="text-[#C3FF00]">Unlimited (Paid)</span>
                      ) : (
                        <>
                          {credits.creditsRemaining} of 5 free inscriptions remaining
                        </>
                      )}
                    </p>
                  </div>
                  {!credits.isPaid && (
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/upgrade", { method: "POST" });
                        const data = await res.json();
                        if (data.checkoutUrl) {
                          window.location.href = data.checkoutUrl;
                        } else if (data.success) {
                          // Dev mode upgrade
                          setCredits({ ...credits, isPaid: true, plan: "paid", creditsRemaining: -1 });
                        }
                      }}
                      className="px-4 py-2 bg-[#C3FF00] text-black text-sm font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
                    >
                      Upgrade ($5)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* One-click inscribe */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Inscribe on</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedChain("base"); setChain("base"); }}
                    className={`px-3 py-1 rounded text-sm font-medium transition ${
                      selectedChain === "base"
                        ? "bg-[#0052FF] text-white"
                        : "bg-zinc-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    Base
                  </button>
                  <button
                    onClick={() => { setSelectedChain("eth"); setChain("eth"); }}
                    className={`px-3 py-1 rounded text-sm font-medium transition ${
                      selectedChain === "eth"
                        ? "bg-[#627EEA] text-white"
                        : "bg-zinc-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    Ethereum
                  </button>
                </div>
              </div>

              {/* Check if user can inscribe */}
              {!credits?.isPaid && credits?.creditsRemaining === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-400 mb-4">You've used all 5 free inscriptions.</p>
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/upgrade", { method: "POST" });
                      const data = await res.json();
                      if (data.checkoutUrl) {
                        window.location.href = data.checkoutUrl;
                      }
                    }}
                    className="px-6 py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
                  >
                    Upgrade to Unlimited ($5)
                  </button>
                </div>
              ) : !inscriptionResult?.success ? (
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    Click below to inscribe your site permanently on Base. You'll need a wallet with some ETH for gas.
                  </p>
                  <button
                    onClick={async () => {
                      // Check credits first
                      const creditsRes = await fetch("/api/credits");
                      const creditsData = await creditsRes.json();
                      if (!creditsData.isPaid && creditsData.creditsRemaining <= 0) {
                        setInscriptionResult({ error: "No credits remaining. Please upgrade to continue." });
                        return;
                      }

                      setIsInscribing(true);
                      setInscriptionResult(null);

                      const html = generatedHtml || customHtml;
                      const result = await inscribeWithUserWallet(html);

                      setInscriptionResult(result);
                      setIsInscribing(false);

                      if (result.success && result.txHash) {
                        setTxHashInput(result.txHash);
                        // Use a credit after successful inscription
                        await fetch("/api/credits/use", { method: "POST" });
                        // Refresh credits
                        const newCredits = await fetch("/api/credits").then(r => r.json());
                        setCredits(newCredits);

                        // Auto-save the site/blog to database
                        if (selectedTemplate === "blog") {
                          await fetch("/api/blog", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              title: blogTitle,
                              author: username || "",
                              content: blogContent,
                              keywords: blogKeywords,
                              tx_hash: result.txHash,
                            }),
                          });
                        }
                        // Save site record
                        await fetch("/api/sites", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: selectedTemplate === "blog" ? blogTitle : siteName,
                            slug: username,
                            template: selectedTemplate,
                            style: selectedStyle,
                            html: generatedHtml || customHtml,
                            inscription_tx: result.txHash,
                            chain: result.chain || selectedChain,
                          }),
                        });
                      }
                    }}
                    disabled={isInscribing}
                    className="w-full px-6 py-4 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition disabled:opacity-50"
                  >
                    {isInscribing ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Inscribing...
                      </span>
                    ) : (
                      "Inscribe Now"
                    )}
                  </button>

                  {inscriptionResult?.error && (
                    <p className="text-red-500 text-sm mt-3">{inscriptionResult.error}</p>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[#C3FF00]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-semibold">Inscribed successfully!</span>
                  </div>

                  {/* Preview of inscribed content */}
                  <div className="border border-zinc-700 rounded-lg overflow-hidden">
                    <iframe
                      srcDoc={generatedHtml || customHtml}
                      className="w-full h-[300px] border-0 bg-white"
                      title="Your inscribed site"
                    />
                  </div>

                  <div className="flex gap-3">
                    <a
                      href={`https://${username}.chainhost.online`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center py-3 bg-[#C3FF00] text-black font-semibold rounded-lg hover:bg-[#d4ff4d] transition"
                    >
                      View Your Site
                    </a>
                    <a
                      href={inscriptionResult.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-3 border border-zinc-700 rounded-lg text-gray-400 hover:text-white hover:border-zinc-500 transition text-sm"
                    >
                      Tx ↗
                    </a>
                  </div>

                  <p className="text-xs text-gray-600 text-center font-mono break-all">
                    {inscriptionResult.txHash}
                  </p>
                </div>
              )}
            </div>

            {/* Go to Dashboard after inscription */}
            {inscriptionResult?.success && (
              <div className="text-center mb-6">
                <a
                  href="/dashboard"
                  className="inline-block px-6 py-3 border border-zinc-700 rounded-lg hover:border-[#C3FF00] transition"
                >
                  Go to Dashboard
                </a>
              </div>
            )}

            {/* Manual entry fallback */}
            {!inscriptionResult?.success && (
              <details className="mb-6">
                <summary className="text-gray-500 text-sm cursor-pointer hover:text-gray-400">
                  Already inscribed? Enter tx hash manually
                </summary>
                <div className="mt-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <input
                    type="text"
                    value={txHashInput}
                    onChange={(e) => setTxHashInput(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:border-[#C3FF00] focus:outline-none mb-3"
                    placeholder="0x..."
                  />
                  <button
                    onClick={async () => {
                      if (!txHashInput || !txHashInput.startsWith("0x")) {
                        alert("Please enter a valid transaction hash");
                        return;
                      }

                      if (selectedTemplate === "blog") {
                        const res = await fetch("/api/blog", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            title: blogTitle,
                            author: blogAuthor,
                            content: blogContent,
                            keywords: blogKeywords,
                            tx_hash: txHashInput,
                          }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          window.location.href = "/dashboard";
                        } else {
                          alert("Failed to save: " + (data.error || "Unknown error"));
                        }
                      } else {
                        window.location.href = "/dashboard";
                      }
                    }}
                    disabled={!txHashInput}
                    className="w-full px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition disabled:opacity-50"
                  >
                    Save with existing tx
                  </button>
                </div>
              </details>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setStep("customize")}
                className="px-6 py-3 border border-zinc-700 rounded-lg hover:border-zinc-500 transition"
              >
                Back
              </button>
              <button
                onClick={() => window.location.href = "/dashboard"}
                className="flex-1 px-6 py-3 border border-zinc-700 rounded-lg hover:border-zinc-500 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>}>
      <BuilderContent />
    </Suspense>
  );
}
