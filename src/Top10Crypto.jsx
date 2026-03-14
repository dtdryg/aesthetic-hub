import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Top10Crypto = () => {
  const [top10, setTop10] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
          params: {
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: 10,
            page: 1,
          },
        });
        setTop10(res.data);
      } catch (err) {
        console.error("Failed to fetch crypto data:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        background: '#111',
        color: '#fff',
        padding: '15px',
        borderRadius: '8px',
        width: '240px',
        position: 'absolute',
        right: '20px',
        bottom: '120px',
        maxHeight: '400px',
        overflowY: 'auto',
        boxShadow: '0 0 10px rgba(255,255,255,0.1)',
      }}
    >
      <h3 style={{ marginBottom: '12px' }}>Top 10 Cryptos</h3>
      {top10.map((coin) => (
        <div
          key={coin.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '10px',
            fontSize: '13px',
          }}
        >
          <img
            src={coin.image}
            alt={coin.name}
            style={{ width: '20px', height: '20px' }}
          />
          <div>
            <div style={{ fontWeight: 'bold' }}>{coin.name}</div>
            <div style={{ fontSize: '12px', color: '#ccc' }}>
              ${coin.current_price?.toLocaleString() ?? 'N/A'}{' '}
              ({coin.price_change_percentage_24h?.toFixed(2) ?? 'N/A'}%)
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Top10Crypto;

