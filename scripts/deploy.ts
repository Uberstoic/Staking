import { ethers } from "hardhat";
import { Contract } from "ethers";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy Mock Tokens for testing
  console.log("\nDeploying Mock Tokens...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const initialSupply = ethers.utils.parseEther("1000000");
  
  const rewardToken = await MockERC20.deploy("Reward Token", "RWD", initialSupply);
  await rewardToken.deployed();
  console.log("Reward Token deployed to:", rewardToken.address);

  const lpToken = await MockERC20.deploy("LP Token", "LP", initialSupply);
  await lpToken.deployed();
  console.log("LP Token deployed to:", lpToken.address);

  // Deploy Staking Contract
  console.log("\nDeploying Staking Contract...");
  const stakingDuration = 7 * 24 * 60 * 60; // 7 days
  const rewardRate = ethers.utils.parseEther("0.0001"); // 0.0001 tokens per second per staked token

  const Staking = await ethers.getContractFactory("Staking");
  const staking = await Staking.deploy(
    lpToken.address,
    rewardToken.address,
    stakingDuration,
    rewardRate
  );
  await staking.deployed();
  console.log("Staking Contract deployed to:", staking.address);

  // Fund reward pool
  console.log("\nFunding reward pool...");
  const rewardPool = ethers.utils.parseEther("10000");
  await rewardToken.approve(staking.address, rewardPool);
  await staking.fundRewardPool(rewardPool);
  console.log("Reward pool funded with:", ethers.utils.formatEther(rewardPool), "tokens");

  // Deploy Liquidity Manager
  console.log("\nDeploying Liquidity Manager...");
  const ROUTER_ADDRESS = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008"; // Uniswap V2 Router on Sepolia
  const LiquidityManager = await ethers.getContractFactory("LiquidityManager");
  const liquidityManager = await LiquidityManager.deploy(ROUTER_ADDRESS);
  await liquidityManager.deployed();
  console.log("Liquidity Manager deployed to:", liquidityManager.address);

  // Create liquidity pool and add initial liquidity
  console.log("\nCreating Uniswap V2 liquidity pool...");
  const tokenAmount = ethers.utils.parseEther("100000");
  const ethAmount = ethers.utils.parseEther("10"); // 10 ETH

  // Approve liquidity manager to spend tokens
  await rewardToken.approve(liquidityManager.address, tokenAmount);

  // Add liquidity
  console.log("Adding initial liquidity...");
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now
  
  try {
    const tx = await liquidityManager.addLiquidityETH(
      rewardToken.address,
      tokenAmount,
      0, // Min token amount
      0, // Min ETH amount
      deadline,
      { value: ethAmount }
    );
    await tx.wait();
    console.log("Successfully added liquidity!");
  } catch (error) {
    console.error("Failed to add liquidity:", error);
  }

  // Print deployment summary
  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log("Reward Token:", rewardToken.address);
  console.log("LP Token:", lpToken.address);
  console.log("Staking Contract:", staking.address);
  console.log("Liquidity Manager:", liquidityManager.address);
  console.log("Uniswap V2 Router:", ROUTER_ADDRESS);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
