document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('ticker-table-body');
    const refreshBtn = document.getElementById('refresh-btn');
    const lastUpdatedEl = document.getElementById('last-updated');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    // Add Ticker elements
    const newTickerSymbol = document.getElementById('new-ticker-symbol');
    const newTickerTarget = document.getElementById('new-ticker-target');
    const addTickerBtn = document.getElementById('add-ticker-btn');
    
    // Summary elements
    const totalTickersEl = document.getElementById('total-tickers');
    const activeAlertsEl = document.getElementById('active-alerts');
    const marketStatusEl = document.getElementById('market-status');

    let isFetching = false;

    // Add Ticker Handler
    addTickerBtn.addEventListener('click', async () => {
        const symbol = newTickerSymbol.value.trim();
        const target = parseFloat(newTickerTarget.value);
        
        if (!symbol) {
            alert('Please enter a ticker symbol');
            return;
        }
        
        try {
            addTickerBtn.disabled = true;
            addTickerBtn.textContent = 'Adding...';
            
            const response = await fetch('/api/favorites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ticker: symbol,
                    target: target || 0
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                newTickerSymbol.value = '';
                newTickerTarget.value = '';
                fetchData(); // Refresh data
            } else {
                alert(data.error || 'Failed to add ticker');
            }
        } catch (error) {
            console.error('Error adding ticker:', error);
            alert('Error adding ticker');
        } finally {
            addTickerBtn.disabled = false;
            addTickerBtn.textContent = 'Add Ticker';
        }
    });

    // Remove Ticker Handler
    window.removeTicker = async (symbol) => {
        if (!confirm(`Are you sure you want to remove ${symbol}?`)) return;
        
        try {
            const response = await fetch(`/api/favorites/${symbol}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                fetchData(); // Refresh data
            } else {
                alert(data.error || 'Failed to remove ticker');
            }
        } catch (error) {
            console.error('Error removing ticker:', error);
            alert('Error removing ticker');
        }
    };

    // Format currency
    const formatCurrency = (value) => {
        if (value === null || value === undefined) return '-';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };

    // Format percentage
    const formatPercent = (value) => {
        if (value === null || value === undefined) return '-';
        const formatted = value.toFixed(2) + '%';
        const colorClass = value >= 0 ? 'text-success' : 'text-danger';
        const icon = value >= 0 ? '▲' : '▼';
        return `<span class="${colorClass}">${icon} ${formatted}</span>`;
    };

    // Generate SVG Sparkline
    const createSparkline = (prices, color) => {
        if (!prices || prices.length < 2) return '';
        
        const width = 100;
        const height = 30;
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min || 1;
        
        const points = prices.map((p, i) => {
            const x = (i / (prices.length - 1)) * width;
            const y = height - ((p - min) / range) * height;
            return `${x},${y}`;
        }).join(' ');

        return `
            <svg width="${width}" height="${height}" class="trend-sparkline">
                <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" />
            </svg>
        `;
    };

    // Render 52W Range Bar
    const createRangeBar = (current, low, high) => {
        if (!low || !high || !current) return '';
        
        const range = high - low || 1;
        const position = ((current - low) / range) * 100;
        const clampedPos = Math.max(0, Math.min(100, position));
        
        return `
            <div class="range-bar-container">
                <div class="range-bar-fill" style="width: 100%; background: linear-gradient(90deg, #cf6679 0%, #03dac6 100%); opacity: 0.3;"></div>
                <div class="range-marker" style="left: ${clampedPos}%; background-color: #fff;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #888; margin-top: 2px;">
                <span>${low.toFixed(0)}</span>
                <span>${high.toFixed(0)}</span>
            </div>
        `;
    };

    const fetchData = async () => {
        if (isFetching) return;
        isFetching = true;
        refreshBtn.disabled = true;
        loadingOverlay.classList.add('active');

        try {
            const response = await fetch('/data');
            const data = await response.json();
            
            renderTable(data.tickers);
            updateSummary(data.summary);
            
            const now = new Date();
            lastUpdatedEl.textContent = `Last updated: ${now.toLocaleTimeString()}`;
            
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Failed to fetch data. Please try again.');
        } finally {
            isFetching = false;
            refreshBtn.disabled = false;
            loadingOverlay.classList.remove('active');
        }
    };

    const updateSummary = (summary) => {
        if (!summary) return;
        totalTickersEl.textContent = summary.total_tickers || 0;
        activeAlertsEl.textContent = summary.alerts_triggered ? summary.alerts_triggered.length : 0;
        
        // Simple market status logic (if more than 50% are up)
        // This would require calculating from tickers, but for now let's just say "Open" or "Closed" based on time?
        // Or better, "Bullish" / "Bearish" based on successful tickers
        // Let's skip market status for now or make it simple
        marketStatusEl.textContent = 'Active'; 
    };

    const renderTable = (tickers) => {
        tableBody.innerHTML = '';
        
        tickers.forEach(ticker => {
            const row = document.createElement('tr');
            
            const isAlert = ticker.alert_triggered;
            const priceColor = ticker.price_change_pct_24h >= 0 ? '#03dac6' : '#cf6679';
            
            row.innerHTML = `
                <td>
                    <div style="font-weight: bold;">${ticker.ticker}</div>
                    ${isAlert ? '<div class="alert-badge">Target Hit</div>' : ''}
                </td>
                <td>
                    <div style="font-size: 1.1rem; font-weight: 600;">${formatCurrency(ticker.current_price)}</div>
                </td>
                <td>${formatPercent(ticker.price_change_pct_24h)}</td>
                <td>${formatCurrency(ticker.target_price)}</td>
                <td>
                    ${createRangeBar(ticker.current_price, ticker.week52_low, ticker.week52_high)}
                </td>
                <td>
                    ${createSparkline(ticker.history?.prices, priceColor)}
                </td>
                <td>
                    <button onclick="removeTicker('${ticker.ticker}')" style="background: transparent; border: 1px solid var(--danger-color); color: var(--danger-color); padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Remove</button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    };

    // Initial fetch
    fetchData();

    // Refresh button handler
    refreshBtn.addEventListener('click', fetchData);

    // Auto refresh every 60 seconds
    setInterval(fetchData, 60000);
});
