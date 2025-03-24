const searchInput = document.getElementById('search-input');
        const searchBtn = document.getElementById('search-btn');
        const themeToggle = document.getElementById('theme-toggle');
        const suggestionsContainer = document.getElementById('suggestions-container');
        const charCounter = document.getElementById('char-counter');
        const aiSearchBtn = document.getElementById('ai-search-btn');
        const bookmarkBtn = document.getElementById('bookmark-btn');
        const bookmarksContainer = document.getElementById('bookmarks-container');

        let lastInputValue = '';
        let typingTimer;
        let prefetchedResults = {};
        let isFetching = false;
        let isTyping = false;
        const doneTypingInterval = 300;
        let activeContainer = null;

        document.addEventListener('DOMContentLoaded', function () {
            const lazyElements = document.querySelectorAll('.lazy-load');

            function isInViewport(element) {
                const rect = element.getBoundingClientRect();
                return (
                    rect.top >= 0 &&
                    rect.left >= 0 &&
                    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                );
            }

            function handleLazyLoad() {
                lazyElements.forEach(element => {
                    if (isInViewport(element)) {
                        element.classList.add('visible');
                    }
                });
            }

            setTimeout(handleLazyLoad, 100);

            window.addEventListener('scroll', handleLazyLoad);
        });

        themeToggle.addEventListener('click', () => {
            const html = document.documentElement;
            if (html.getAttribute('data-theme') === 'light') {
                html.setAttribute('data-theme', 'dark');
                updateThemeIcon('dark');
                localStorage.setItem('theme', 'dark');
            } else {
                html.setAttribute('data-theme', 'light');
                updateThemeIcon('light');
                localStorage.setItem('theme', 'light');
            }
        });

        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            updateThemeIcon(savedTheme);
        } else {
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                document.documentElement.setAttribute('data-theme', 'dark');
                updateThemeIcon('dark');
            }
        }

        function updateThemeIcon(theme) {
            themeToggle.innerHTML = theme === 'dark'
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 0 1 1-9-9Z"></path></svg>';
        }

        function performSearch(query, isLucky = false) {
            if (!query) return;

            // Update search history
            updateSearchHistory(query);

            const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?$/i;
            const openInNewTab = localStorage.getItem('openInNewTab') === 'true';

            if (urlPattern.test(query)) {
                const url = query.startsWith('http') ? query : 'https://' + query;
                if (openInNewTab) {
                    window.open(url, '_blank');
                } else {
                    window.location.href = url;
                }
                return;
            }

            const engine = searchEngines[currentEngine];
            const searchUrl = isLucky ?
                engine.luckyUrl.replace('{q}', encodeURIComponent(query)) :
                engine.url + encodeURIComponent(query);

            if (openInNewTab) {
                window.open(searchUrl, '_blank');
            } else {
                window.location.href = searchUrl;
            }
        }

        // Function to update search history
        function updateSearchHistory(query) {
            // Get existing search history
            let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || {};

            // Update count for this query
            searchHistory[query] = (searchHistory[query] || 0) + 1;

            // Store updated history
            localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
        }

        // Function to get top searches
        function getTopSearches(limit = 4) {
            const searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || {};

            // Convert to array of [query, count] pairs
            const searchEntries = Object.entries(searchHistory);

            // Sort by count (descending)
            searchEntries.sort((a, b) => b[1] - a[1]);

            // Return just the queries, limited to specified count
            return searchEntries.slice(0, limit).map(entry => entry[0]);
        }

        // Function to get all searches
        function getAllSearches() {
            const searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || {};
            return Object.keys(searchHistory);
        }

        function fetchSuggestions(query) {
            if (query.length < 1 && query !== '') {
                suggestionsContainer.classList.remove('visible');
                return;
            }

            // Close bookmarks container if it's open
            if (bookmarksContainer.classList.contains('visible')) {
                bookmarksContainer.classList.remove('visible');
            }

            if (prefetchedResults[query]) {
                displaySuggestions(prefetchedResults[query], query);
                return;
            }

            if (!isFetching) {
                isFetching = true;

                setTimeout(() => {
                    let suggestions = [];

                    if (query === '') {
                        // When input is empty, show top 4 searches
                        suggestions = getTopSearches(4);
                    } else {
                        // Get all searches that match the query
                        const allSearches = getAllSearches();
                        const matchingSearches = allSearches.filter(search =>
                            search.toLowerCase().includes(query.toLowerCase()));

                        // Sort matching searches: first the top 5, then the rest
                        const topSearches = getTopSearches();

                        // First add top searches that match the query
                        const matchingTopSearches = topSearches.filter(search =>
                            search.toLowerCase().includes(query.toLowerCase()));
                        suggestions = [...matchingTopSearches];

                        // Then add other matching searches
                        const otherMatchingSearches = matchingSearches.filter(search =>
                            !topSearches.includes(search));
                        suggestions = [...suggestions, ...otherMatchingSearches];

                        // If the query itself isn't in our history, add it
                        if (!suggestions.includes(query)) {
                            suggestions.unshift(query);
                        }
                    }

                    // Limit to max 4 suggestions
                    suggestions = suggestions.slice(0, 4);

                    prefetchedResults[query] = suggestions;
                    displaySuggestions(suggestions, query);
                    isFetching = false;
                }, 300);
            }
        }

        function displaySuggestions(suggestions, query) {
            suggestionsContainer.innerHTML = '';

            if (suggestions.length === 0) {
                suggestionsContainer.classList.remove('visible');
                return;
            }

            suggestionsContainer.classList.add('visible');

            // Get top 5 searches for marking
            const topSearches = getTopSearches(5);

            suggestions.forEach((suggestion, index) => {
                const element = document.createElement('div');
                element.className = 'suggestion-item';
                element.style.display = 'flex';
                element.style.justifyContent = 'space-between';
                element.style.alignItems = 'center';

                const textSpan = document.createElement('span');
                textSpan.style.flexGrow = '1';

                // Highlight the match
                const highlightedText = highlightMatch(suggestion, query);

                // If this is one of the top 5 searches, add an indicator
                const isTopSearch = topSearches.includes(suggestion);
                const topSearchIndicator = isTopSearch ? ' <span style="color: var(--primary-color); font-size: 0.8em;">★</span>' : '';

                textSpan.innerHTML = highlightedText + topSearchIndicator;

                // Add delete button
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>`;
                deleteBtn.style.background = 'none';
                deleteBtn.style.border = 'none';
                deleteBtn.style.padding = '4px';
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.style.color = 'var(--text-color)';
                deleteBtn.style.opacity = '0.6';
                deleteBtn.style.transition = 'opacity 0.2s ease';
                deleteBtn.title = 'Remove from history';

                deleteBtn.addEventListener('mouseover', () => {
                    deleteBtn.style.opacity = '1';
                    deleteBtn.style.color = 'var(--primary-color)';
                });

                deleteBtn.addEventListener('mouseout', () => {
                    deleteBtn.style.opacity = '0.6';
                    deleteBtn.style.color = 'var(--text-color)';
                });

                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering the parent click event
                    removeFromSearchHistory(suggestion);
                    element.remove();

                    // If no more suggestions, hide the container
                    if (suggestionsContainer.children.length === 1) { // 1 because of engine selector
                        suggestionsContainer.classList.remove('visible');
                    }
                });

                element.appendChild(textSpan);
                element.appendChild(deleteBtn);

                // Click handler for the suggestion
                textSpan.addEventListener('click', () => {
                    searchInput.value = suggestion;
                    suggestionsContainer.classList.remove('visible');
                    performSearch(suggestion, false);
                });

                suggestionsContainer.appendChild(element);

                setTimeout(() => {
                    element.classList.add('visible');
                }, 50 * index);
            });

            // Add engine selector if not already present
            if (!document.querySelector('.engine-selector')) {
                const engineSelector = document.createElement('div');
                engineSelector.className = 'engine-selector';

                Object.keys(searchEngines).forEach(engineKey => {
                    const btn = document.createElement('button');
                    btn.className = `engine-btn ${engineKey === currentEngine ? 'active' : ''}`;
                    btn.textContent = searchEngines[engineKey].name;
                    btn.onclick = () => {
                        currentEngine = engineKey;
                        localStorage.setItem('searchEngine', engineKey);
                        document.querySelectorAll('.engine-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                    };
                    engineSelector.appendChild(btn);
                });

                suggestionsContainer.appendChild(engineSelector);
            }
        }

        // Add this new function to handle removing items from search history
        function removeFromSearchHistory(query) {
            let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || {};
            delete searchHistory[query];
            localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
        }

        function highlightMatch(text, query) {
            if (query === '') return text;

            const lowerText = text.toLowerCase();
            const lowerQuery = query.toLowerCase();
            const index = lowerText.indexOf(lowerQuery);

            if (index === -1) return text;

            const beforeMatch = text.substring(0, index);
            const match = text.substring(index, index + query.length);
            const afterMatch = text.substring(index + query.length);

            return beforeMatch + '<strong>' + match + '</strong>' + afterMatch;
        }

        function prefetchGoogle(query) {
            if (query.length < 3) return;

            clearTimeout(typingTimer);

            typingTimer = setTimeout(() => {
                const prefetchLink = document.createElement('link');
                prefetchLink.rel = 'prefetch';
                prefetchLink.href = searchEngines[currentEngine].url + encodeURIComponent(query);
                document.head.appendChild(prefetchLink);

                setTimeout(() => {
                    document.head.removeChild(prefetchLink);
                }, 10000);
            }, 500);
        }

        function updateCharCounter() {
            const count = searchInput.value.length;
            charCounter.textContent = count + '/100';

            if (count > 0) {
                charCounter.classList.add('visible');
            } else {
                charCounter.classList.remove('visible');
            }
        }

        searchBtn.addEventListener('click', () => performSearch(searchInput.value, false));

        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                performSearch(searchInput.value, false);
                suggestionsContainer.classList.remove('visible');
            }
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
                this.classList.add('key-press');

                setTimeout(() => {
                    this.classList.remove('key-press');
                }, 150);
            }
        });

        searchInput.addEventListener('input', function () {
            const query = this.value.trim();

            updateCharCounter();

            if (!isTyping && query.length > 0) {
                isTyping = true;
                searchInput.classList.add('input-active');
            } else if (query.length === 0) {
                isTyping = false;
                searchInput.classList.remove('input-active');

                // Show top searches when input is cleared
                fetchSuggestions('');
            }

            clearTimeout(typingTimer);

            if (Math.abs(query.length - lastInputValue.length) > 1 ||
                !query.startsWith(lastInputValue)) {
                prefetchedResults = {}; // Clear cache when there's a major change
                fetchSuggestions(query);
            }

            typingTimer = setTimeout(() => {
                fetchSuggestions(query);

                if (query.length > 2) {
                    prefetchGoogle(query);
                }
            }, doneTypingInterval);

            lastInputValue = query;
        });

        searchInput.addEventListener('focus', function () {
            if (this.value.length > 0) {
                fetchSuggestions(this.value);
            } else {
                // Show top searches when input is focused but empty
                fetchSuggestions('');
            }
        });

        document.addEventListener('click', function (event) {
            if (!searchInput.contains(event.target) &&
                !suggestionsContainer.contains(event.target) &&
                !bookmarkBtn.contains(event.target) &&
                !bookmarksContainer.contains(event.target)) {
                suggestionsContainer.classList.remove('visible');
                bookmarksContainer.classList.remove('visible');
            }
        });

        function lazyLoadElements() {
            const elements = document.querySelectorAll('.lazy-load');
            elements.forEach((element, index) => {
                setTimeout(() => {
                    element.classList.add('visible');
                }, 100 * index);
            });
        }

        window.addEventListener('load', () => {
            setTimeout(() => {
                lazyLoadElements();
                searchInput.focus();
            }, 800);
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1
        });

        document.querySelectorAll('.lazy-load').forEach(element => {
            observer.observe(element);
        });

        aiSearchBtn.addEventListener('click', () => {
            const query = searchInput.value.trim();
            window.location.href = 'https://www.perplexity.ai/';
        });

        bookmarkBtn.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                addBookmark(query);
                displayBookmarks();
            }

            // Close suggestions container if it's open
            if (suggestionsContainer.classList.contains('visible')) {
                suggestionsContainer.classList.remove('visible');
            }

            bookmarksContainer.classList.toggle('visible');
        });

        function addBookmark(url) {
            const bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
            const bookmarkExists = bookmarks.some(bookmark => bookmark.url === url);

            if (!bookmarkExists) {
                const bookmark = { url, timestamp: new Date().toISOString() };
                bookmarks.push(bookmark);
                localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
            }
        }

        function displayBookmarks() {
            const bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
            bookmarksContainer.innerHTML = '';

            bookmarks.forEach((bookmark, index) => {
                const bookmarkElement = document.createElement('div');
                bookmarkElement.className = 'bookmark-item';
                bookmarkElement.innerHTML = `
        <a href="#" class="bookmark-link" data-url="${bookmark.url}">${bookmark.url}</a>
        <button class="remove-bookmark-btn" data-index="${index}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;
                bookmarksContainer.appendChild(bookmarkElement);

                setTimeout(() => {
                    bookmarkElement.classList.add('visible');
                }, 50 * index);
            });

            // Update click handlers for bookmark links
            document.querySelectorAll('.bookmark-link').forEach(link => {
                link.addEventListener('click', function (event) {
                    event.preventDefault();
                    const url = this.getAttribute('data-url');
                    const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?$/i;
                    const openInNewTab = localStorage.getItem('openInNewTab') === 'true';

                    if (urlPattern.test(url)) {
                        // Add https:// if not present
                        const fullUrl = url.startsWith('http') ? url : 'https://' + url;
                        if (openInNewTab) {
                            window.open(fullUrl, '_blank');
                        } else {
                            window.location.href = fullUrl;
                        }
                    } else {
                        // Handle as search query
                        performSearch(url, false);
                    }
                });
            });

            document.querySelectorAll('.remove-bookmark-btn').forEach(button => {
                button.addEventListener('click', function () {
                    const index = this.getAttribute('data-index');
                    removeBookmark(index);
                    displayBookmarks();
                });
            });
        }

        function removeBookmark(index) {
            let bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
            bookmarks.splice(index, 1);
            localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
        }

        displayBookmarks();

        let selectedIndex = -1;
        let currentContainer = null;

        searchInput.addEventListener('keydown', function (e) {
            // Get the active container (suggestions or bookmarks)
            const activeContainer = suggestionsContainer.classList.contains('visible') ?
                suggestionsContainer : bookmarksContainer.classList.contains('visible') ?
                    bookmarksContainer : null;

            if (e.key === 'Enter') {
                e.preventDefault();
                if (activeContainer && selectedIndex >= 0) {
                    // Handle selected item from suggestions or bookmarks
                    const items = activeContainer.children;
                    if (activeContainer === suggestionsContainer) {
                        const suggestion = items[selectedIndex].textContent.replace('★', '').trim();
                        searchInput.value = suggestion;
                        performSearch(suggestion, false);
                    } else {
                        const url = items[selectedIndex].querySelector('.bookmark-link').getAttribute('data-url');
                        performSearch(url, false);
                    }
                    activeContainer.classList.remove('visible');
                    selectedIndex = -1;
                } else {
                    // Perform direct search with current input value
                    performSearch(searchInput.value.trim(), false);
                    if (activeContainer) {
                        activeContainer.classList.remove('visible');
                    }
                }
                return;
            }

            if (!activeContainer) return;

            const items = activeContainer.children;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                    updateSelection(items);
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, -1);
                    updateSelection(items);
                    break;

                case 'Escape':
                    activeContainer.classList.remove('visible');
                    selectedIndex = -1;
                    break;
            }
        });

        function updateSelection(items) {
            // Remove highlight from all items
            Array.from(items).forEach(item => {
                item.style.backgroundColor = '';
            });

            // Highlight selected item
            if (selectedIndex >= 0) {
                items[selectedIndex].style.backgroundColor = 'var(--suggestions-hover)';
                items[selectedIndex].scrollIntoView({ block: 'nearest' });
            }
        }

        // Reset selection when showing new suggestions or bookmarks
        function resetSelection() {
            selectedIndex = -1;
        }

        // Add to existing displaySuggestions function after suggestionsContainer.innerHTML = '';
        const originalDisplaySuggestions = displaySuggestions;
        displaySuggestions = function (suggestions, query) {
            resetSelection();
            originalDisplaySuggestions(suggestions, query);
        };

        // Add to existing displayBookmarks function after bookmarksContainer.innerHTML = '';
        const originalDisplayBookmarks = displayBookmarks;
        displayBookmarks = function () {
            resetSelection();
            originalDisplayBookmarks();
        };

        // Define search engines
        const searchEngines = {
            google: {
                name: 'Google',
                url: 'https://www.google.com/search?q=',
                luckyUrl: 'https://www.google.com/search?q={q}&btnI'
            },
            duckduckgo: {
                name: 'DuckDuckGo',
                url: 'https://duckduckgo.com/?q=',
                luckyUrl: 'https://duckduckgo.com/?q=\\{q}'
            },
            bing: {
                name: 'Bing',
                url: 'https://www.bing.com/search?q=',
                luckyUrl: 'https://www.bing.com/search?q={q}'
            }
        };

        // Get/Set default search engine
        let currentEngine = localStorage.getItem('searchEngine') || 'google';

        // Update prefetchGoogle function to use current engine
        function prefetchGoogle(query) {
            if (query.length < 3) return;

            clearTimeout(typingTimer);

            typingTimer = setTimeout(() => {
                const prefetchLink = document.createElement('link');
                prefetchLink.rel = 'prefetch';
                prefetchLink.href = searchEngines[currentEngine].url + encodeURIComponent(query);
                document.head.appendChild(prefetchLink);

                setTimeout(() => {
                    document.head.removeChild(prefetchLink);
                }, 10000);
            }, 500);
        }

        // Settings Modal functionality
        const settingsBtn = document.getElementById('settings-btn');
        const settingsModal = document.getElementById('settings-modal');
        const closeSettings = document.getElementById('close-settings');
        const exportDataBtn = document.getElementById('export-data');
        const importDataBtn = document.getElementById('import-data');
        const importFile = document.getElementById('import-file');
        const newTabSetting = document.getElementById('new-tab-setting');

        settingsBtn.addEventListener('click', () => {
            settingsModal.style.display = 'flex'; // Change to 'flex' instead of 'block'
        });

        closeSettings.addEventListener('click', () => {
            settingsModal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.style.display = 'none';
            }
        });

        // Export functionality
        exportDataBtn.addEventListener('click', () => {
            const data = {
                searchHistory: JSON.parse(localStorage.getItem('searchHistory') || '{}'),
                bookmarks: JSON.parse(localStorage.getItem('bookmarks') || '[]'),
                theme: localStorage.getItem('theme'),
                searchEngine: localStorage.getItem('searchEngine'),
                openInNewTab: localStorage.getItem('openInNewTab') === 'true'
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'infoseek-data.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        // Import functionality
        importDataBtn.addEventListener('click', () => {
            importFile.click();
        });

        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);

                        // Import search history
                        if (data.searchHistory) {
                            localStorage.setItem('searchHistory', JSON.stringify(data.searchHistory));
                        }

                        // Import bookmarks
                        if (data.bookmarks) {
                            localStorage.setItem('bookmarks', JSON.stringify(data.bookmarks));
                            displayBookmarks();
                        }

                        // Import theme
                        if (data.theme) {
                            localStorage.setItem('theme', data.theme);
                            document.documentElement.setAttribute('data-theme', data.theme);
                            updateThemeIcon(data.theme);
                        }

                        // Import search engine preference
                        if (data.searchEngine) {
                            localStorage.setItem('searchEngine', data.searchEngine);
                            currentEngine = data.searchEngine;
                        }

                        // Import openInNewTab setting
                        if (data.openInNewTab !== undefined) {
                            localStorage.setItem('openInNewTab', data.openInNewTab);
                            newTabSetting.checked = data.openInNewTab;
                        }

                        alert('Data imported successfully!');
                    } catch (error) {
                        alert('Error importing data. Please make sure the file is valid.');
                        console.error('Import error:', error);
                    }
                };
                reader.readAsText(file);
            }
        });

        // Load saved preference
        newTabSetting.checked = localStorage.getItem('openInNewTab') === 'true';

        // Save preference when changed
        newTabSetting.addEventListener('change', function () {
            localStorage.setItem('openInNewTab', this.checked);
        });

        // Add after the existing button declarations
        const previewSearchBtn = document.createElement('button');
        previewSearchBtn.className = 'preview-search-button';
        previewSearchBtn.title = 'Preview search';
        previewSearchBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" 
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
        <circle cx="12" cy="12" r="3"/>
    </svg>
`;

        // Insert the preview button into the input container
        const inputContainer = document.querySelector('.input-container');
        inputContainer.insertBefore(previewSearchBtn, bookmarkBtn);

        // Add preview functionality
        const previewContainer = document.getElementById('preview-container');
        const previewFrame = document.getElementById('preview-frame');
        const openFullPage = document.getElementById('open-full-page');
        const closePreview = document.getElementById('close-preview');
        const previewTitle = document.getElementById('preview-title');

        previewSearchBtn.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (!query) return;

            // Check if input is a URL
            const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?$/i;
            let previewUrl;

            if (urlPattern.test(query)) {
                // Always add https:// for direct URLs if not present
                previewUrl = query.startsWith('http') ? query : 'https://' + query;
                previewTitle.textContent = `Preview: ${previewUrl}`;
            } else {
                // Use Bing for searches since it works better with preview
                previewUrl = searchEngines.bing.url + encodeURIComponent(query);
                previewTitle.textContent = `Preview: Search for "${query}"`;
            }

            // Load the URL in the preview frame
            previewFrame.src = previewUrl;
            previewContainer.style.display = 'block';
        });

        openFullPage.addEventListener('click', () => {
            const openInNewTab = localStorage.getItem('openInNewTab') === 'true';
            if (openInNewTab) {
                window.open(previewFrame.src, '_blank');
            } else {
                window.location.href = previewFrame.src;
            }
        });

        closePreview.addEventListener('click', () => {
            previewContainer.style.display = 'none';
            previewFrame.src = '';
            document.getElementById('embed-error').style.display = 'none';
        });

        // Close preview when clicking outside
        document.addEventListener('click', (e) => {
            if (!previewContainer.contains(e.target) &&
                !previewSearchBtn.contains(e.target) &&
                previewContainer.style.display === 'block') {
                previewContainer.style.display = 'none';
                previewFrame.src = '';
                document.getElementById('embed-error').style.display = 'none';
            }
        });

        // Add ESC key handler to close preview
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && previewContainer.style.display === 'block') {
                previewContainer.style.display = 'none';
                previewFrame.src = '';
                document.getElementById('embed-error').style.display = 'none';
            }
        });

        previewFrame.addEventListener('load', () => {
            previewFrame.style.display = 'block';
        });

        // First, update the CSS for embed-error
        const style = document.createElement('style');
        style.textContent = `
        .embed-error {
            display: block !important; /* Always show */
            position: absolute;
            bottom: 10px; /* Position at bottom */
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            color: var(--text-color);
            padding: 10px;
            background-color: var(--bg-color);
            border-radius: 4px;
            font-size: 12px;
            opacity: 0.8;
            pointer-events: none; /* Don't interfere with iframe interaction */
            z-index: 1001;
        }

        .embed-error p {
            margin: 0;
            color: var(--placeholder-color);
        }
        `;
        document.head.appendChild(style);

        // Update the HTML for the embed-error div
        document.getElementById('embed-error').innerHTML = `
    <p>Note: Only Bing searches can be previewed. Some websites may not allow previewing.</p>
    `;
