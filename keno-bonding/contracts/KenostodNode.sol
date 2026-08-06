// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Kenostod Network Node NFT
 *
 * Each node entitles the holder to a proportional share of 10% of the
 * Kenostod arb bot fleet's daily profits, distributed by the bot wallet.
 *
 * Max supply  : 20 nodes
 * Price       : 0.5 BNB per node
 * Proceeds    : forwarded to bot wallet (treasury) on each mint
 */

interface IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4);
}

contract KenostodNode {
    // ── ERC-721 storage ───────────────────────────────────────────────────────
    string public name     = "Kenostod Network Node";
    string public symbol   = "KNODE";
    uint256 public totalSupply;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // ── Node sale config ──────────────────────────────────────────────────────
    uint256 public constant MAX_NODES   = 20;
    uint256 public constant NODE_PRICE  = 0.5 ether;  // 0.5 BNB
    uint256 public constant NODE_YIELD_PCT = 10;       // 10% of daily bot profits
    address public immutable treasury;                 // bot wallet receives proceeds
    address public owner;

    bool public saleOpen = true;

    // ── Node metadata ─────────────────────────────────────────────────────────
    mapping(uint256 => uint256) public mintedAt;   // block timestamp of mint

    // ── Events ────────────────────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner_, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner_, address indexed operator, bool approved);
    event NodeMinted(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event SaleToggled(bool open);

    // ── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(address _treasury) {
        owner    = msg.sender;
        treasury = _treasury;
    }

    // ── Sale ──────────────────────────────────────────────────────────────────
    function mintNode() external payable {
        require(saleOpen,                          "Sale closed");
        require(totalSupply < MAX_NODES,           "All 20 nodes sold");
        require(msg.value == NODE_PRICE,           "Send exactly 0.5 BNB");

        totalSupply++;
        uint256 tokenId = totalSupply;

        _owners[tokenId]    = msg.sender;
        _balances[msg.sender]++;
        mintedAt[tokenId]   = block.timestamp;

        // Forward BNB to treasury immediately
        (bool sent, ) = treasury.call{value: msg.value}("");
        require(sent, "BNB transfer failed");

        emit Transfer(address(0), msg.sender, tokenId);
        emit NodeMinted(tokenId, msg.sender, msg.value);
    }

    function toggleSale() external onlyOwner {
        saleOpen = !saleOpen;
        emit SaleToggled(saleOpen);
    }

    // ── Node info ─────────────────────────────────────────────────────────────
    function nodesRemaining() external view returns (uint256) {
        return MAX_NODES - totalSupply;
    }

    function nodesByOwner(address holder) external view returns (uint256[] memory) {
        uint256 count = _balances[holder];
        uint256[] memory ids = new uint256[](count);
        uint256 idx;
        for (uint256 i = 1; i <= totalSupply; i++) {
            if (_owners[i] == holder) {
                ids[idx++] = i;
            }
        }
        return ids;
    }

    // ── ERC-721 core ──────────────────────────────────────────────────────────
    function balanceOf(address holder) external view returns (uint256) {
        return _balances[holder];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address o = _owners[tokenId];
        require(o != address(0), "Nonexistent token");
        return o;
    }

    function approve(address to, uint256 tokenId) external {
        address o = _owners[tokenId];
        require(msg.sender == o || _operatorApprovals[o][msg.sender], "Not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(o, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address holder, address operator) external view returns (bool) {
        return _operatorApprovals[holder][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_owners[tokenId] == from,                                     "Wrong owner");
        require(to != address(0),                                             "Zero address");
        require(
            msg.sender == from ||
            _tokenApprovals[tokenId] == msg.sender ||
            _operatorApprovals[from][msg.sender],
            "Not authorized"
        );
        _balances[from]--;
        _balances[to]++;
        _owners[tokenId]         = to;
        _tokenApprovals[tokenId] = address(0);
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (to.code.length > 0) {
            bytes4 ret = IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data);
            require(ret == IERC721Receiver.onERC721Received.selector, "Not ERC721Receiver");
        }
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0x80ac58cd || // ERC721
            interfaceId == 0x01ffc9a7;  // ERC165
    }

    // ── Token URI (on-chain SVG) ───────────────────────────────────────────────
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_owners[tokenId] != address(0), "Nonexistent token");
        return string(abi.encodePacked(
            'data:application/json;utf8,{"name":"Kenostod Node #', _toString(tokenId),
            '","description":"Kenostod Network Node - earns 10% of daily arb bot profits proportionally among all 20 nodes.",',
            '"image":"data:image/svg+xml;utf8,<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 300 300\\">',
            '<rect width=\\"300\\" height=\\"300\\" fill=\\"#0d1117\\"/>',
            '<text x=\\"150\\" y=\\"120\\" font-family=\\"monospace\\" font-size=\\"14\\" fill=\\"#667eea\\" text-anchor=\\"middle\\">KENOSTOD</text>',
            '<text x=\\"150\\" y=\\"155\\" font-family=\\"monospace\\" font-size=\\"36\\" fill=\\"#f6ad55\\" text-anchor=\\"middle\\">NODE</text>',
            '<text x=\\"150\\" y=\\"185\\" font-family=\\"monospace\\" font-size=\\"18\\" fill=\\"#48bb78\\" text-anchor=\\"middle\\">#', _toString(tokenId),
            '</text><text x=\\"150\\" y=\\"220\\" font-family=\\"monospace\\" font-size=\\"11\\" fill=\\"#94a3b8\\" text-anchor=\\"middle\\">10% Daily Bot Profits</text>',
            '</svg>","attributes":[{"trait_type":"Node ID","value":', _toString(tokenId),
            '},{"trait_type":"Yield Share","value":"10% / 20 nodes"}]}'
        ));
    }

    function _toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 tmp = v;
        uint256 digits;
        while (tmp != 0) { digits++; tmp /= 10; }
        bytes memory buf = new bytes(digits);
        while (v != 0) { digits--; buf[digits] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(buf);
    }
}
