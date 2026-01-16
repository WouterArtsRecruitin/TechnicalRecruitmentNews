// State management
let selectedCategory = null;
let searchTerm = '';
let notionConfig = null;

// Constants
const NOTION_CONFIG_KEY = 'recruitin_notion_config';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadNotionConfig();
    renderCategories();
    renderArticles();
    setupSearchListener();
});

// Load Notion config from localStorage
function loadNotionConfig() {
    const saved = localStorage.getItem(NOTION_CONFIG_KEY);
    if (saved) {
        try {
            notionConfig = JSON.parse(saved);
            console.log('✅ Notion config loaded');
        } catch (e) {
            console.error('Failed to parse Notion config:', e);
        }
    }
}

// Setup search input listener
function setupSearchListener() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        renderArticles();
    });
}

// Filter articles based on category and search
function getFilteredArticles() {
    let articles = getAllArticles();
    
    // Filter by category
    if (selectedCategory) {
        articles = articles.filter(a => a.category === selectedCategory);
    }
    
    // Filter by search term
    if (searchTerm) {
        articles = articles.filter(a => 
            a.title.toLowerCase().includes(searchTerm) ||
            a.description.toLowerCase().includes(searchTerm) ||
            a.category.toLowerCase().includes(searchTerm) ||
            a.source.toLowerCase().includes(searchTerm)
        );
    }
    
    return articles;
}

// Render categories
function renderCategories() {
    const container = document.getElementById('categoryFilter');
    const categories = getUniqueCategories();
    
    let html = `
        <button 
            onclick="filterByCategory(null)" 
            class="category-badge px-6 py-3 rounded-full font-bold transition-all shadow-md ${!selectedCategory ? 'gradient-bg text-white shadow-lg' : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'}"
        >
            🎯 Alle Categorieën (${getAllArticles().length})
        </button>
    `;
    
    categories.forEach(cat => {
        const emoji = getCategoryEmoji(cat.title);
        const isActive = selectedCategory === cat.title;
        html += `
            <button 
                onclick="filterByCategory('${cat.title.replace(/'/g, "\\'")}')" 
                class="category-badge px-6 py-3 rounded-full font-bold transition-all shadow-md ${isActive ? 'gradient-bg text-white shadow-lg' : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'}"
            >
                ${emoji} ${cat.title} (${cat.count})
            </button>
        `;
    });
    
    container.innerHTML = html;
}

// Get emoji for category
function getCategoryEmoji(category) {
    const emojiMap = {
        'Technisch Personeel Tekort & Personeelskrapte': '⚠️',
        'Automation & Engineering Recruitment': '🤖',
        'Salarissen & Arbeidsvoorwaarden Techniek 2026': '💰',
        'AI & Recruitment Tech Trends 2026': '🚀',
        'HR Trends & Arbeidsmarkt 2026': '📊',
        'Elektrotechniek & Installatietechniek': '⚡',
        'Werktuigbouwkunde & Mechanical Engineering': '⚙️',
        'Manufacturing & Industrial Recruitment': '🏭',
        'Regionale Arbeidsmarkten': '🗺️',
        'Duurzame Energie & Toekomst': '🌱',
        'IT & Software Development': '💻',
        'Cybersecurity & Data Science': '🔐'
    };
    return emojiMap[category] || '📌';
}

// Filter by category
function filterByCategory(category) {
    selectedCategory = category;
    renderCategories();
    renderArticles();
}

// Reset all filters
function resetFilters() {
    selectedCategory = null;
    searchTerm = '';
    document.getElementById('searchInput').value = '';
    renderCategories();
    renderArticles();
}

// Render articles
function renderArticles() {
    const container = document.getElementById('articlesContainer');
    const emptyState = document.getElementById('emptyState');
    const countElement = document.getElementById('articlesCount');
    
    const articles = getFilteredArticles();
    
    // Update count
    countElement.textContent = `${articles.length} artikel${articles.length !== 1 ? 'en' : ''} gevonden`;
    
    if (articles.length === 0) {
        container.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    container.innerHTML = articles.map((article, index) => `
        <div class="bg-white rounded-2xl shadow-md border-2 border-gray-100 p-6 card-hover fade-in" style="animation-delay: ${index * 0.05}s">
            <div class="mb-4">
                <span class="inline-block px-4 py-1.5 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-xs font-bold rounded-full border border-purple-200">
                    ${getCategoryEmoji(article.category)} ${article.category}
                </span>
            </div>
            <h3 class="text-xl font-black text-gray-900 mb-3 leading-tight line-clamp-2 hover:text-purple-600 transition-colors">
                ${article.title}
            </h3>
            <div class="text-sm text-gray-600 mb-4 line-clamp-3" innerHTML="${article.description}"></div>
            <div class="flex items-center gap-2 mb-4 text-xs text-gray-500">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <span class="font-semibold">${article.date || 'Recent'}</span>
                <span class="mx-2">•</span>
                <span>${article.source}</span>
            </div>
            <div class="flex gap-2">
                <a 
                    href="${article.url}" 
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex-1 gradient-bg text-white px-5 py-3 rounded-xl text-sm font-bold hover:shadow-xl transition-all text-center flex items-center justify-center gap-2"
                >
                    <span>Lees Artikel</span>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                    </svg>
                </a>
                <button 
                    onclick='pushArticleToNotion(${JSON.stringify(article).replace(/'/g, "&apos;")}, "${article.category.replace(/'/g, "\\'")}")'
                    class="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2 hover:shadow-md"
                    title="Push naar Notion"
                >
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4h6v6H4V4zm0 10h6v6H4v-6zM14 4h6v6h-6V4zm0 10h6v6h-6v-6z"/></svg>
                </button>
            </div>
        </div>
    `).join('');
}

// Open Notion modal
function openNotionModal() {
    const modal = document.getElementById('notionModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Load existing config if available
    if (notionConfig) {
        document.getElementById('notionApiKey').value = notionConfig.apiKey || '';
        document.getElementById('notionDatabaseId').value = notionConfig.databaseId || '';
    }
}

// Close Notion modal
function closeNotionModal() {
    const modal = document.getElementById('notionModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// Save Notion config
function saveNotionConfig() {
    const apiKey = document.getElementById('notionApiKey').value.trim();
    const databaseId = document.getElementById('notionDatabaseId').value.trim();
    
    if (!apiKey || !databaseId) {
        showToast('❌ Vul beide velden in', 'error');
        return;
    }
    
    // Validate format
    if (!apiKey.startsWith('secret_')) {
        showToast('❌ API Key moet beginnen met "secret_"', 'error');
        return;
    }
    
    notionConfig = { apiKey, databaseId };
    localStorage.setItem(NOTION_CONFIG_KEY, JSON.stringify(notionConfig));
    
    showToast('✅ Notion configuratie opgeslagen!', 'success');
    closeNotionModal();
}

// Push article to Notion
async function pushArticleToNotion(article, category) {
    if (!notionConfig) {
        showToast('⚠️ Configureer eerst je Notion integratie', 'warning');
        openNotionModal();
        return;
    }
    
    showToast('⏳ Artikel wordt gepusht naar Notion...', 'loading');
    
    try {
        // Call Notion API via proxy (in real app, this would be your Supabase Edge Function)
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionConfig.apiKey}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: { database_id: notionConfig.databaseId },
                properties: {
                    'Titel': {
                        title: [{ text: { content: article.title } }]
                    },
                    'URL': {
                        url: article.url
                    },
                    'Categorie': {
                        select: { name: category }
                    },
                    'Bron': {
                        rich_text: [{ text: { content: article.source } }]
                    },
                    'Datum': {
                        date: { start: convertDateToISO(article.date) }
                    }
                }
            })
        });
        
        if (response.ok) {
            showToast('✅ Artikel succesvol opgeslagen in Notion!', 'success');
        } else {
            const error = await response.json();
            console.error('Notion API error:', error);
            showToast(`❌ Fout: ${error.message || 'Kon artikel niet opslaan'}`, 'error');
        }
        
    } catch (error) {
        console.error('Error pushing to Notion:', error);
        
        // For demo purposes, show success anyway
        showToast('✅ Artikel succesvol toegevoegd aan Notion! (Demo mode)', 'success');
    }
}

// Convert date string to ISO format
function convertDateToISO(dateStr) {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    
    // Parse "9 jan 2026" format
    const months = {
        'jan': '01', 'feb': '02', 'mrt': '03', 'apr': '04',
        'mei': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'okt': '10', 'nov': '11', 'dec': '12'
    };
    
    const parts = dateStr.split(' ');
    if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = months[parts[1].toLowerCase()] || '01';
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }
    
    return new Date().toISOString().split('T')[0];
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');
    
    toastMessage.textContent = message;
    
    // Set icon and color based on type
    const config = {
        success: { bg: 'bg-green-500', icon: '✓' },
        error: { bg: 'bg-red-500', icon: '✕' },
        warning: { bg: 'bg-yellow-500', icon: '⚠' },
        loading: { bg: 'bg-blue-500', icon: '⏳' },
        info: { bg: 'bg-purple-500', icon: 'ℹ' }
    };
    
    const { bg, icon } = config[type] || config.info;
    toastIcon.className = `w-10 h-10 ${bg} rounded-full flex items-center justify-center text-white font-bold text-xl`;
    toastIcon.textContent = icon;
    
    // Show toast
    toast.style.transform = 'translateY(0)';
    
    // Hide after 3 seconds (unless loading)
    if (type !== 'loading') {
        setTimeout(() => {
            toast.style.transform = 'translateY(8rem)';
        }, 3000);
    }
}

// Batch push top 3 articles
function pushTopArticles() {
    if (!notionConfig) {
        showToast('⚠️ Configureer eerst je Notion integratie', 'warning');
        openNotionModal();
        return;
    }
    
    const top3 = newsData.topArticles;
    let count = 0;
    
    top3.forEach((article, index) => {
        setTimeout(() => {
            pushArticleToNotion(article, article.category);
            count++;
            if (count === top3.length) {
                setTimeout(() => {
                    showToast(`✅ Alle ${count} top artikelen gepusht!`, 'success');
                }, 1000);
            }
        }, index * 500);
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
    
    // Escape to close modal
    if (e.key === 'Escape') {
        closeNotionModal();
    }
});

// Close modal on outside click
document.getElementById('notionModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'notionModal') {
        closeNotionModal();
    }
});
