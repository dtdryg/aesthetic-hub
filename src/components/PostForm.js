import React, { useState } from 'react';
import { mineBlock } from '../api/blockchain';

const PostForm = () => {
  const [data, setData] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    await mineBlock(data);
    alert('Post added to blockchain!');
    window.location.reload();
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
      <input
        type="text"
        value={data}
        onChange={(e) => setData(e.target.value)}
        placeholder="Write a post"
        required
      />
      <button type="submit">Post</button>
    </form>
  );
};

export default PostForm;
