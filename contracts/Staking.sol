// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

error CannotStakeZero();
error InvalidLPTokenAddress();
error InvalidRewardTokenAddress();
error InvalidStakingDuration();
error InvalidRewardRate();
error NothingToUnstake();
error StakingDurationNotMet();
error NoRewardsInPool();
error InsufficientRewardPool();
error NoRewardsToClaim();
error TransferFailed();

contract Staking is Ownable, ReentrancyGuard {
    IERC20 public lpToken;
    IERC20 public rewardToken;
    
    uint256 public stakingDuration;
    uint256 public rewardRate;
    
    struct UserInfo {
        uint256 amount;
        uint256 stakingTime;
        uint256 lastClaimTime;
        uint256 rewardDebt;
    }
    
    mapping(address => UserInfo) public userInfo;
    
    uint256 public totalStaked;
    uint256 public totalRewardPool;
    
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event StakingDurationUpdated(uint256 newDuration);
    event RewardRateUpdated(uint256 newRate);
    event RewardPoolFunded(uint256 amount);
    
    constructor(
        address _lpToken,
        address _rewardToken,
        uint256 _stakingDuration,
        uint256 _rewardRate
    ) Ownable(msg.sender) {
        if (_lpToken == address(0)) revert InvalidLPTokenAddress();
        if (_rewardToken == address(0)) revert InvalidRewardTokenAddress();
        if (_stakingDuration == 0) revert InvalidStakingDuration();
        if (_rewardRate == 0) revert InvalidRewardRate();
        
        lpToken = IERC20(_lpToken);
        rewardToken = IERC20(_rewardToken);
        stakingDuration = _stakingDuration;
        rewardRate = _rewardRate;
    }
    
    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert CannotStakeZero();
        
        UserInfo storage user = userInfo[msg.sender];
        
        if (!lpToken.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        
        user.amount += amount;
        user.stakingTime = block.timestamp;
        if (user.lastClaimTime == 0) {
            user.lastClaimTime = block.timestamp;
        }
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }
    
    function unstake() external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        if (user.amount == 0) revert NothingToUnstake();
        if (block.timestamp < user.stakingTime + stakingDuration) revert StakingDurationNotMet();
        
        uint256 pending = calculateReward(msg.sender);
        if (pending > 0) {
            safeRewardTransfer(msg.sender, pending);
        }
        
        uint256 amount = user.amount;
        user.amount = 0;
        user.stakingTime = 0;
        user.lastClaimTime = 0;
        totalStaked -= amount;
        
        if (!lpToken.transfer(msg.sender, amount)) revert TransferFailed();
        
        emit Unstaked(msg.sender, amount);
    }
    
    function claim() external nonReentrant {
        uint256 reward = calculateReward(msg.sender);
        if (reward == 0) revert NoRewardsToClaim();
        
        UserInfo storage user = userInfo[msg.sender];
        user.lastClaimTime = block.timestamp;
        
        safeRewardTransfer(msg.sender, reward);
        
        emit RewardClaimed(msg.sender, reward);
    }
    
    function calculateReward(address _user) public view returns (uint256) {
        UserInfo storage user = userInfo[_user];
        if (user.amount == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - user.lastClaimTime;
        return (user.amount * timeElapsed * rewardRate) / 1e18;
    }
    
    function setStakingDuration(uint256 _newDuration) external onlyOwner {
        if (_newDuration == 0) revert InvalidStakingDuration();
        stakingDuration = _newDuration;
        emit StakingDurationUpdated(_newDuration);
    }
    
    function setRewardRate(uint256 _newRate) external onlyOwner {
        if (_newRate == 0) revert InvalidRewardRate();
        rewardRate = _newRate;
        emit RewardRateUpdated(_newRate);
    }
    
    function safeRewardTransfer(address _to, uint256 _amount) internal {
        uint256 rewardBalance = rewardToken.balanceOf(address(this));
        if (rewardBalance == 0) revert NoRewardsInPool();
        
        uint256 transferAmount = _amount > rewardBalance ? rewardBalance : _amount;
        if (transferAmount > totalRewardPool) revert InsufficientRewardPool();
        
        totalRewardPool -= transferAmount;
        if (!rewardToken.transfer(_to, transferAmount)) revert TransferFailed();
    }
    
    function fundRewardPool(uint256 amount) external {
        if (amount == 0) revert InvalidRewardRate();
        if (!rewardToken.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        totalRewardPool += amount;
        emit RewardPoolFunded(amount);
    }
    
    function getUserStakeInfo(address _user) external view returns (
        uint256 stakedAmount,
        uint256 stakingTime,
        uint256 lastClaimTime,
        uint256 pendingRewards
    ) {
        UserInfo storage user = userInfo[_user];
        return (
            user.amount,
            user.stakingTime,
            user.lastClaimTime,
            calculateReward(_user)
        );
    }
}