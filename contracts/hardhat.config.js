require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    aesthetic_chain: {
      url: "http://127.0.0.1:4000", // Flask blockchain RPC
      chainId: 777,
      accounts: [process.env.PRIVATE_KEY], // do NOT paste your key here
    },
  },
};
