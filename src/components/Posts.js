import React, { useEffect, useState } from 'react';
import { getBlocks } from '../api/blockchain';

const Posts = () => {
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    const fetchBlocks = async () => {
      const res = await getBlocks();
      setBlocks(res.data);
    };
    fetchBlocks();
  }, []);

  return (
    <div>
      <h2>On-Chain Posts</h2>
      {blocks.map((block) => (
        <div key={block.index} style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '10px' }}>
          <p><strong>Index:</strong> {block.index}</p>
          <p><strong>Data:</strong> {block.data}</p>
          <p><strong>Hash:</strong> {block.hash}</p>
        </div>
      ))}
    </div>
  );
};

export default Posts;
