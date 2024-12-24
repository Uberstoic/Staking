import { ethers } from "hardhat";
import { Contract } from "ethers";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Use existing token as reward token
  const EXISTING_TOKEN_ADDRESS = "0x657eB176645e44A4128c38730e666A7B201e0Cf9";
  console.log("\nUsing existing token as reward token:", EXISTING_TOKEN_ADDRESS);
  const rewardToken = await ethers.getContractAt("IERC20", EXISTING_TOKEN_ADDRESS);

  // Get Uniswap LP Token address
  const FACTORY_ADDRESS = "0x7E0987E5b3a30e3f2828572Bb659A548460a3003";
  const WETH_ADDRESS = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
  
  const factoryAbi = ["function getPair(address tokenA, address tokenB) external view returns (address pair)"];
  const factory = new ethers.Contract(FACTORY_ADDRESS, factoryAbi, deployer);
  
  const lpTokenAddress = await factory.getPair(EXISTING_TOKEN_ADDRESS, WETH_ADDRESS);
  console.log("\nUsing Uniswap LP Token:", lpTokenAddress);

  // Deploy Staking Contract
  console.log("\nDeploying Staking Contract...");
  const stakingDuration = 7 * 24 * 60 * 60; // 7 days
  const rewardRate = ethers.utils.parseEther("0.0001"); // 0.0001 tokens per second per staked token

  const Staking = await ethers.getContractFactory("Staking");
  const staking = await Staking.deploy(
    lpTokenAddress,
    EXISTING_TOKEN_ADDRESS,
    stakingDuration,
    rewardRate
  );
  await staking.deployed();
  console.log("Staking Contract deployed to:", staking.address);

  // Fund reward pool
  console.log("\nFunding reward pool...");
  const rewardPool = ethers.utils.parseEther("100"); 
  console.log("Approving transfer of", ethers.utils.formatEther(rewardPool), "tokens...");
  const approveTx = await rewardToken.approve(staking.address, rewardPool);
  console.log("Waiting for approve transaction...");
  await approveTx.wait();
  console.log("Approval confirmed!");
  
  console.log("Funding reward pool with tokens...");
  const fundTx = await staking.fundRewardPool(rewardPool);
  await fundTx.wait();
  console.log("Reward pool funded with:", ethers.utils.formatEther(rewardPool), "tokens");

  // Print deployment summary
  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log("Reward Token:", EXISTING_TOKEN_ADDRESS);
  console.log("LP Token:", lpTokenAddress);
  console.log("Staking Contract:", staking.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
