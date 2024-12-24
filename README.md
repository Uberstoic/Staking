# Staking 

A decentralized staking platform built on Ethereum, allowing users to stake LP tokens and earn reward tokens. This project implements a secure staking mechanism with configurable durations and reward rates.

## Features

The staking platform includes:

- LP token staking functionality
- Configurable staking duration (default: 7 days)
- Dynamic reward rate system
- Secure reward distribution mechanism
- Anti-reentrancy protection
- Owner-controlled reward pool management
- Reward claiming functionality
- Complete test coverage

## Smart Contract Components

### Main Contracts
- `Staking.sol`: Core staking contract that handles deposits, withdrawals, and reward distribution
- Implements OpenZeppelin's `Ownable` and `ReentrancyGuard` for security

### Key Functions
- `stake()`: Stake LP tokens into the platform
- `unstake()`: Withdraw staked LP tokens after duration completion
- `claim()`: Claim accumulated rewards
- `fundRewardPool()`: Owner function to add rewards to the pool
- `calculateReward()`: Calculate pending rewards for a user

## Technical Details

### Dependencies
- OpenZeppelin Contracts
- Hardhat Development Environment
- TypeScript for testing and deployment
- Uniswap V2 LP tokens supported

### Deployment Information
- Factory Address: `0x7E0987E5b3a30e3f2828572Bb659A548460a3003`
- WETH Address: `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`
- Reward Token: `0x657eB176645e44A4128c38730e666A7B201e0Cf9`

### Configuration
- Default Staking Duration: 7 days
- Default Reward Rate: 0.0001 tokens per second per staked token
- Initial Reward Pool: 100 tokens

## Development and Testing

### Local Development
```bash
npm install
npx hardhat compile
npx hardhat test
```

### Deployment
```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

### Testing
The project includes comprehensive tests covering:
- Contract deployment
- Staking functionality
- Reward calculations
- Unstaking mechanisms
- Security features

## Security Features

- ReentrancyGuard implementation
- Ownership controls
- Safe transfer checks
- Duration validations
- Zero-amount protection