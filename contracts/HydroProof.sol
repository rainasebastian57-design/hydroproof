// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract HydroProof {
    enum EscrowStatus { AWAITING_DEPOSIT, FUNDED, COMPLETED, REFUNDED }

    struct Escrow {
        address buyer;
        address seller;
        address token;
        uint256 amount;
        uint256 waterThresholdLiters;
        EscrowStatus status;
    }

    address public oracle;
    uint256 public escrowCounter;
    mapping(uint256 => Escrow) public escrows;

    event EscrowCreated(
        uint256 indexed escrowId, 
        address indexed buyer, 
        address indexed seller, 
        uint256 amount, 
        uint256 waterThresholdLiters
    );
    event EscrowFunded(uint256 indexed escrowId);
    event EscrowSettledByOracle(uint256 indexed escrowId, uint256 reportedUsage, bool limitExceeded);

    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle can execute");
        _;
    }

    constructor() {
        oracle = msg.sender;
    }

    function createEscrow(
        address _seller, 
        address _token, 
        uint256 _amount, 
        uint256 _waterThresholdLiters
    ) external returns (uint256) {
        require(_seller != address(0) && _seller != msg.sender, "Invalid seller");
        require(_amount > 0, "Amount must be > 0");

        uint256 escrowId = ++escrowCounter;
        escrows[escrowId] = Escrow({
            buyer: msg.sender,
            seller: _seller,
            token: _token,
            amount: _amount,
            waterThresholdLiters: _waterThresholdLiters,
            status: EscrowStatus.AWAITING_DEPOSIT
        });

        emit EscrowCreated(escrowId, msg.sender, _seller, _amount, _waterThresholdLiters);
        return escrowId;
    }

    function deposit(uint256 _escrowId) external {
        Escrow storage item = escrows[_escrowId];
        require(msg.sender == item.buyer, "Only buyer can fund");
        require(item.status == EscrowStatus.AWAITING_DEPOSIT, "Invalid status");

        item.status = EscrowStatus.FUNDED;
        require(IERC20(item.token).transferFrom(msg.sender, address(this), item.amount), "Transfer failed");

        emit EscrowFunded(_escrowId);
    }

    // Automated Oracle Settlement based on water consumption metrics
    function settleEscrowWithWaterData(uint256 _escrowId, uint256 _reportedUsageLiters) external onlyOracle {
        Escrow storage item = escrows[_escrowId];
        require(item.status == EscrowStatus.FUNDED, "Escrow not funded");

        bool limitExceeded = _reportedUsageLiters > item.waterThresholdLiters;

        if (limitExceeded) {
            // Over limit: Compensation released to Water Authority / Seller
            item.status = EscrowStatus.COMPLETED;
            require(IERC20(item.token).transfer(item.seller, item.amount), "Release failed");
        } else {
            // Within limit: Deposit refunded back to AI Company / Buyer
            item.status = EscrowStatus.REFUNDED;
            require(IERC20(item.token).transfer(item.buyer, item.amount), "Refund failed");
        }

        emit EscrowSettledByOracle(_escrowId, _reportedUsageLiters, limitExceeded);
    }
}