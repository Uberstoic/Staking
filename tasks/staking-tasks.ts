import { task } from "hardhat/config";
import { Contract } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// Add your deployed contract addresses here
const STAKING_ADDRESS = "YOUR_STAKING_CONTRACT_ADDRESS";
const LP_TOKEN_ADDRESS = "YOUR_LP_TOKEN_ADDRESS";

task("stake", "Stake LP tokens")
  .addParam("amount", "Amount of LP tokens to stake")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    
    // Get contract instances
    const staking = await hre.ethers.getContractAt("Staking", STAKING_ADDRESS, signer);
    const lpToken = await hre.ethers.getContractAt("IERC20", LP_TOKEN_ADDRESS, signer);

    // Approve staking contract to spend LP tokens
    const amount = hre.ethers.utils.parseEther(taskArgs.amount);
    console.log(`Approving ${taskArgs.amount} LP tokens...`);
    await lpToken.approve(STAKING_ADDRESS, amount);

    // Stake LP tokens
    console.log(`Staking ${taskArgs.amount} LP tokens...`);
    const tx = await staking.stake(amount);
    await tx.wait();
    
    console.log("Staking successful!");
    
    // Get updated stake info
    const stakeInfo = await staking.getUserStakeInfo(signer.address);
    console.log("\nYour Staking Info:");
    console.log(`Staked Amount: ${hre.ethers.utils.formatEther(stakeInfo.stakedAmount)} LP tokens`);
    console.log(`Staking Time: ${new Date(stakeInfo.stakingTime.toNumber() * 1000).toLocaleString()}`);
    console.log(`Pending Rewards: ${hre.ethers.utils.formatEther(stakeInfo.pendingRewards)} tokens`);
  });

task("unstake", "Unstake LP tokens")
  .setAction(async (_, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const staking = await hre.ethers.getContractAt("Staking", STAKING_ADDRESS, signer);

    // Get current stake info
    const stakeInfo = await staking.getUserStakeInfo(signer.address);
    console.log("\nCurrent Staking Info:");
    console.log(`Staked Amount: ${hre.ethers.utils.formatEther(stakeInfo.stakedAmount)} LP tokens`);
    
    // Unstake tokens
    console.log("\nUnstaking tokens...");
    const tx = await staking.unstake();
    await tx.wait();
    
    console.log("Unstaking successful!");
  });

task("claim", "Claim reward tokens")
  .setAction(async (_, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const staking = await hre.ethers.getContractAt("Staking", STAKING_ADDRESS, signer);

    // Get current rewards
    const stakeInfo = await staking.getUserStakeInfo(signer.address);
    console.log(`\nPending Rewards: ${hre.ethers.utils.formatEther(stakeInfo.pendingRewards)} tokens`);
    
    // Claim rewards
    console.log("\nClaiming rewards...");
    const tx = await staking.claim();
    await tx.wait();
    
    console.log("Rewards claimed successfully!");
  });
