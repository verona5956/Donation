import { ethers } from "ethers";

async function checkIfHardhatNodeIsRunning() {
  const provider = new ethers.JsonRpcProvider("http://localhost:8545");
  try {
    const blockNumber = await provider.getBlockNumber();
    console.log(`Ethereum node is running. Current block number: ${blockNumber}`);
  } catch {
    console.error("\n");
    console.error("===============================================================================\n");
    console.error(" Hardhat Node is not running!\n");
    console.error(" 1) Open a new terminal\n 2) cd Donation/backend\n 3) npx hardhat node --verbose\n");
    console.error("===============================================================================\n");
    console.error("\n");
    process.exit(1);
  }
}

checkIfHardhatNodeIsRunning();


