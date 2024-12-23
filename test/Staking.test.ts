import { expect, use } from "chai";
import { ethers, waffle } from "hardhat";
import { Contract, BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

use(waffle.solidity);

describe("Staking", function () {
  let staking: Contract;
  let lpToken: Contract;
  let rewardToken: Contract;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const INITIAL_SUPPLY = ethers.utils.parseEther("1000000");
  const STAKE_AMOUNT = ethers.utils.parseEther("1000");
  const REWARD_POOL = ethers.utils.parseEther("10000");
  const STAKING_DURATION = 7 * 24 * 60 * 60; // 7 days
  const REWARD_RATE = ethers.utils.parseEther("0.0001"); // 0.0001 tokens per second per staked token

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory("MockERC20");
    lpToken = await MockToken.deploy("LP Token", "LP", INITIAL_SUPPLY);
    rewardToken = await MockToken.deploy("Reward Token", "RWD", INITIAL_SUPPLY);

    // Deploy staking contract
    const Staking = await ethers.getContractFactory("Staking");
    staking = await Staking.deploy(
      lpToken.address,
      rewardToken.address,
      STAKING_DURATION,
      REWARD_RATE
    );

    // Fund reward pool
    await rewardToken.approve(staking.address, REWARD_POOL);
    await staking.fundRewardPool(REWARD_POOL);

    // Transfer some LP tokens to users
    await lpToken.transfer(user1.address, STAKE_AMOUNT.mul(2));
    await lpToken.transfer(user2.address, STAKE_AMOUNT.mul(2));
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await staking.owner()).to.equal(owner.address);
    });

    it("Should set the correct token addresses", async function () {
      expect(await staking.lpToken()).to.equal(lpToken.address);
      expect(await staking.rewardToken()).to.equal(rewardToken.address);
    });

    it("Should set the correct staking parameters", async function () {
      const duration = await staking.stakingDuration();
      const rate = await staking.rewardRate();
      expect(duration).to.equal(STAKING_DURATION);
      expect(rate).to.equal(REWARD_RATE);
    });

    it("Should not deploy with zero address for LP token", async function () {
      const Staking = await ethers.getContractFactory("Staking");
      await expect(
        Staking.deploy(
          ethers.constants.AddressZero,
          rewardToken.address,
          STAKING_DURATION,
          REWARD_RATE
        )
      ).to.be.revertedWith("InvalidLPTokenAddress");
    });

    it("Should not deploy with zero address for reward token", async function () {
      const Staking = await ethers.getContractFactory("Staking");
      await expect(
        Staking.deploy(
          lpToken.address,
          ethers.constants.AddressZero,
          STAKING_DURATION,
          REWARD_RATE
        )
      ).to.be.revertedWith("InvalidRewardTokenAddress");
    });

    it("Should not deploy with zero staking duration", async function () {
      const Staking = await ethers.getContractFactory("Staking");
      await expect(
        Staking.deploy(
          lpToken.address,
          rewardToken.address,
          0,
          REWARD_RATE
        )
      ).to.be.revertedWith("InvalidStakingDuration");
    });

    it("Should not deploy with zero reward rate", async function () {
      const Staking = await ethers.getContractFactory("Staking");
      await expect(
        Staking.deploy(
          lpToken.address,
          rewardToken.address,
          STAKING_DURATION,
          0
        )
      ).to.be.revertedWith("InvalidRewardRate");
    });
  });

  describe("Staking", function () {
    beforeEach(async function () {
      await lpToken.connect(user1).approve(staking.address, STAKE_AMOUNT);
    });

    it("Should stake tokens correctly", async function () {
      await staking.connect(user1).stake(STAKE_AMOUNT);
      const userInfo = await staking.userInfo(user1.address);
      
      expect(userInfo.amount).to.equal(STAKE_AMOUNT);
      expect((await staking.totalStaked())).to.equal(STAKE_AMOUNT);
    });

    it("Should not allow staking 0 amount", async function () {
      await expect(
        staking.connect(user1).stake(0)
      ).to.be.revertedWith("CannotStakeZero");
    });

    it("Should fail if transfer fails", async function () {
      // Approve less than stake amount to simulate transfer failure
      await lpToken.connect(user1).approve(staking.address, STAKE_AMOUNT.div(2));
      await expect(
        staking.connect(user1).stake(STAKE_AMOUNT)
      ).to.be.revertedWith("ERC20InsufficientAllowance");
    });

    it("Should update lastClaimTime on first stake", async function () {
      await staking.connect(user1).stake(STAKE_AMOUNT);
      const userInfo = await staking.userInfo(user1.address);
      const blockTimestamp = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      expect(userInfo.lastClaimTime).to.equal(blockTimestamp);
    });
  });

  describe("Rewards", function () {
    beforeEach(async function () {
      await lpToken.connect(user1).approve(staking.address, STAKE_AMOUNT);
      await staking.connect(user1).stake(STAKE_AMOUNT);
    });

    it("Should calculate rewards correctly", async function () {
      // Increase time by 1 day
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      const reward = await staking.calculateReward(user1.address);
      expect(reward).to.be.above(0);
    });

    it("Should return 0 rewards for non-staker", async function () {
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      const reward = await staking.calculateReward(user2.address);
      expect(reward).to.equal(0);
    });

    it("Should claim rewards correctly", async function () {
      // Increase time by 1 day
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      const initialBalance = await rewardToken.balanceOf(user1.address);
      await staking.connect(user1).claim();
      const finalBalance = await rewardToken.balanceOf(user1.address);

      expect(finalBalance).to.be.above(initialBalance);
    });

    it("Should not allow claiming 0 rewards", async function () {
      await expect(
        staking.connect(user2).claim()
      ).to.be.revertedWith("NoRewardsToClaim");
    });

    it("Should fail if reward pool is empty", async function () {
      // Deploy new contract without funding reward pool
      const Staking = await ethers.getContractFactory("Staking");
      const newStaking = await Staking.deploy(
        lpToken.address,
        rewardToken.address,
        STAKING_DURATION,
        REWARD_RATE
      );

      await lpToken.connect(user1).approve(newStaking.address, STAKE_AMOUNT);
      await newStaking.connect(user1).stake(STAKE_AMOUNT);

      // Increase time to accumulate rewards
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        newStaking.connect(user1).claim()
      ).to.be.revertedWith("NoRewardsInPool");
    });

    it("Should handle multiple claims correctly", async function () {
      // First claim
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await staking.connect(user1).claim();
      const firstClaimTime = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);

      // Second claim
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      await staking.connect(user1).claim();
      const secondClaimTime = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);

      const userInfo = await staking.userInfo(user1.address);
      expect(userInfo.lastClaimTime).to.equal(secondClaimTime);
    });
  });

  describe("Unstaking", function () {
    beforeEach(async function () {
      await lpToken.connect(user1).approve(staking.address, STAKE_AMOUNT);
      await staking.connect(user1).stake(STAKE_AMOUNT);
    });

    it("Should not allow unstaking before duration", async function () {
      await expect(
        staking.connect(user1).unstake()
      ).to.be.revertedWith("StakingDurationNotMet");
    });

    it("Should not allow unstaking with no stake", async function () {
      await expect(
        staking.connect(user2).unstake()
      ).to.be.revertedWith("NothingToUnstake");
    });

    it("Should allow unstaking after duration", async function () {
      // Increase time past staking duration
      await ethers.provider.send("evm_increaseTime", [STAKING_DURATION]);
      await ethers.provider.send("evm_mine", []);

      const initialBalance = await lpToken.balanceOf(user1.address);
      await staking.connect(user1).unstake();
      const finalBalance = await lpToken.balanceOf(user1.address);

      expect(finalBalance.sub(initialBalance)).to.equal(STAKE_AMOUNT);
    });

    it("Should reset user info after unstaking", async function () {
      await ethers.provider.send("evm_increaseTime", [STAKING_DURATION]);
      await ethers.provider.send("evm_mine", []);

      await staking.connect(user1).unstake();
      const userInfo = await staking.userInfo(user1.address);

      expect(userInfo.amount).to.equal(0);
      expect(userInfo.stakingTime).to.equal(0);
      expect(userInfo.lastClaimTime).to.equal(0);
    });

    it("Should update total staked after unstaking", async function () {
      await ethers.provider.send("evm_increaseTime", [STAKING_DURATION]);
      await ethers.provider.send("evm_mine", []);

      const initialTotalStaked = await staking.totalStaked();
      await staking.connect(user1).unstake();
      const finalTotalStaked = await staking.totalStaked();

      expect(finalTotalStaked).to.equal(0);
      expect(finalTotalStaked.lt(initialTotalStaked)).to.be.true;
    });
  });

  describe("Admin functions", function () {
    it("Should allow owner to update staking duration", async function () {
      const newDuration = STAKING_DURATION * 2;
      await staking.setStakingDuration(newDuration);
      const duration = await staking.stakingDuration();
      expect(duration).to.equal(newDuration);
    });

    it("Should not allow setting zero staking duration", async function () {
      await expect(
        staking.setStakingDuration(0)
      ).to.be.revertedWith("InvalidStakingDuration");
    });

    it("Should allow owner to update reward rate", async function () {
      const newRate = REWARD_RATE.mul(2);
      await staking.setRewardRate(newRate);
      const rate = await staking.rewardRate();
      expect(rate).to.equal(newRate);
    });

    it("Should not allow setting zero reward rate", async function () {
      await expect(
        staking.setRewardRate(0)
      ).to.be.revertedWith("InvalidRewardRate");
    });

    it("Should not allow non-owner to update parameters", async function () {
      await expect(
        staking.connect(user1).setStakingDuration(STAKING_DURATION)
      ).to.be.revertedWith("OwnableUnauthorizedAccount");
      
      await expect(
        staking.connect(user1).setRewardRate(REWARD_RATE)
      ).to.be.revertedWith("OwnableUnauthorizedAccount");
    });
  });

  describe("Reward Pool", function () {
    it("Should not allow funding with zero amount", async function () {
      await expect(
        staking.fundRewardPool(0)
      ).to.be.revertedWith("InvalidRewardRate");
    });

    it("Should update totalRewardPool after funding", async function () {
      const initialPool = await staking.totalRewardPool();
      const fundAmount = ethers.utils.parseEther("1000");
      
      await rewardToken.approve(staking.address, fundAmount);
      await staking.fundRewardPool(fundAmount);
      
      const finalPool = await staking.totalRewardPool();
      expect(finalPool.sub(initialPool)).to.equal(fundAmount);
    });

    it("Should emit RewardPoolFunded event", async function () {
      const fundAmount = ethers.utils.parseEther("1000");
      await rewardToken.approve(staking.address, fundAmount);
      
      await expect(staking.fundRewardPool(fundAmount))
        .to.emit(staking, "RewardPoolFunded")
        .withArgs(fundAmount);
    });

    it("Should fail if transfer fails", async function () {
      const fundAmount = ethers.utils.parseEther("1000");
      // Don't approve to simulate transfer failure
      await expect(
        staking.fundRewardPool(fundAmount)
      ).to.be.revertedWith("ERC20InsufficientAllowance");
    });
  });

  describe("View functions", function () {
    it("Should return correct user info", async function () {
      await lpToken.connect(user1).approve(staking.address, STAKE_AMOUNT);
      await staking.connect(user1).stake(STAKE_AMOUNT);

      const userInfo = await staking.getUserStakeInfo(user1.address);
      expect(userInfo.stakedAmount).to.equal(STAKE_AMOUNT);
      expect(userInfo.stakingTime).to.be.above(0);
      expect(userInfo.lastClaimTime).to.be.above(0);
      expect(userInfo.pendingRewards).to.equal(0);
    });

    it("Should return zero values for non-staker", async function () {
      const userInfo = await staking.getUserStakeInfo(user2.address);
      expect(userInfo.stakedAmount).to.equal(0);
      expect(userInfo.stakingTime).to.equal(0);
      expect(userInfo.lastClaimTime).to.equal(0);
      expect(userInfo.pendingRewards).to.equal(0);
    });
  });
});
