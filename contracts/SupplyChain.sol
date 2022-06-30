pragma solidity >=0.7.0 <0.9.0;

library CryptoSuite {
    function splitSignature(bytes memory sig)
        internal
        pure
        returns (
            uint8 v,
            bytes32 r,
            bytes32 s
        )
    {
        require(sig.length == 65);

        assembly {
            //  first 32bytes
            r := mload(add(sig, 32))

            //  next 32bytes
            s := mload(add(sig, 64))

            //  last 32bytes
            v := byte(0, mload(add(sig, 96)))
        }

        return (v, r, s);
    }

    function recoverSigner(bytes32 message, bytes memory sig)
        internal
        pure
        returns (address)
    {
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(sig);
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixHash = keccak256(abi.encodePacked(prefix, message));

        return ecrecover(prefixHash, v, r, s);
    }
}

contract SupplyChain {
    enum Role {
        SUPPLIER,
        MANUFACTURER,
        TRANSPORTER,
        DISTRIBUTER,
        RETAILER,
        CUSTOMER
    }

    enum ProductStatus {
        MANUFACTURING,
        MANUFACTURED,
        IN_TRANSPORT,
        STORED,
        USED
    }

    struct Entity {
        address id;
        Role role;
        uint256[] transactionIds;
    }

    struct Product {
        uint256 id;
        string name;
        address manufacturer;
        uint256[] goods; // poluproizvodi
        uint256[] transactionIds;
    }

    struct Transaction {
        uint256 id;
        Entity issuer;
        Entity receiver;
        bytes signature;
        ProductStatus status;
    }

    uint256 public constant MAX_CERTIFICATIONS = 20;

    uint256[] public transactionIds;
    uint256[] public productIds;

    mapping(uint256 => Product) public products;
    mapping(uint256 => Transaction) public transactions;
    mapping(address => Entity) public entities;

    event AddEntity(address entityId, string entityRole);
    event AddProduct(uint256 productId, address indexed manufacturer);
    event IssueTransaction(
        address indexed issuer,
        address indexed receiver,
        uint256 transactionId
    );
    event GetTransactionsForEntity(
        address indexed issuer,
        uint256[] transactions
    );

    function addEntity(address _id, string memory _role) public {
        Role role = unmarshalRole(_role);
        uint256[] memory _transactionIds = new uint256[](MAX_CERTIFICATIONS);
        Entity memory entity = Entity(_id, role, _transactionIds);
        entities[_id] = entity;
        emit AddEntity(entity.id, _role);
    }

    function unmarshalRole(string memory _role)
        private
        pure
        returns (Role role)
    {
        bytes32 encodedRole = keccak256(abi.encodePacked(_role));
        bytes32 encodedRole0 = keccak256(abi.encodePacked("SUPPLIER"));
        bytes32 encodedRole1 = keccak256(abi.encodePacked("MANUFACTURER"));
        bytes32 encodedRole2 = keccak256(abi.encodePacked("TRANSPORTER"));
        bytes32 encodedRole3 = keccak256(abi.encodePacked("DISTRIBUTER"));
        bytes32 encodedRole4 = keccak256(abi.encodePacked("RETAILER"));
        bytes32 encodedRole5 = keccak256(abi.encodePacked("CUSTOMER"));

        if (encodedRole == encodedRole0) {
            return Role.SUPPLIER;
        } else if (encodedRole == encodedRole1) {
            return Role.MANUFACTURER;
        } else if (encodedRole == encodedRole2) {
            return Role.TRANSPORTER;
        } else if (encodedRole == encodedRole3) {
            return Role.DISTRIBUTER;
        } else if (encodedRole == encodedRole4) {
            return Role.RETAILER;
        } else if (encodedRole == encodedRole5) {
            return Role.CUSTOMER;
        }

        revert("received invalid entity role");
    }

    function addProduct( string memory name, address manufacturer, uint256 semiProductId ) public returns (uint256) {
        uint256[] memory _transactionIds = new uint256[](MAX_CERTIFICATIONS);
        uint256[] memory _goods = new uint256[](MAX_CERTIFICATIONS);
        uint256 id = productIds.length;

        if (semiProductId != 100) {
            _goods[0] = semiProductId;
        }

        Product memory product = Product(
            id,
            name,
            manufacturer,
            _goods,
            _transactionIds
        );

        products[id] = product;
        productIds.push(id);

        emit AddProduct(product.id, product.manufacturer);
        return id;
    }

    function issueTransaction(
        address _issuer,
        address _receiver,
        string memory _status,
        uint256 productId,
        bytes memory signature
    ) public returns (uint256) {
        Entity memory issuer = entities[_issuer];
        // require(issuer.mode == Mode.ISSUER);

        Entity memory receiver = entities[_receiver];
        // require(prover.mode == Mode.PROVER);

        ProductStatus status = ProductStatus.MANUFACTURED;
        // ProductStatus status = unmarshalStatus(_status);

        uint256 id = transactionIds.length;
        Transaction memory transaction = Transaction(
            id,
            issuer,
            receiver,
            signature,
            status
        );

        transactionIds.push(transactionIds.length);
        transactions[transactionIds.length - 1] = transaction;

        emit IssueTransaction(_issuer, _receiver, transactionIds.length - 1);

        return transactionIds.length - 1;
    }

    function unmarshalStatus(string memory _status)
        private
        pure
        returns (ProductStatus status)
    {
        bytes32 encodedStatus = keccak256(abi.encodePacked(_status));
        bytes32 encodedStatus0 = keccak256(abi.encodePacked("MANUFACTURING"));
        bytes32 encodedStatus1 = keccak256(abi.encodePacked("MANUFACTURED"));
        bytes32 encodedStatus2 = keccak256(abi.encodePacked("IN_TRANSPORT"));
        bytes32 encodedStatus3 = keccak256(abi.encodePacked("STORED"));
        bytes32 encodedStatus4 = keccak256(abi.encodePacked("USED"));

        if (encodedStatus == encodedStatus0) {
            return ProductStatus.MANUFACTURING;
        } else if (encodedStatus == encodedStatus1) {
            return ProductStatus.MANUFACTURED;
        } else if (encodedStatus == encodedStatus2) {
            return ProductStatus.IN_TRANSPORT;
        } else if (encodedStatus == encodedStatus3) {
            return ProductStatus.STORED;
        } else if (encodedStatus == encodedStatus4) {
            return ProductStatus.USED;
        }

        revert("received invalid Product Status");
    }

    function isMatchingSignature(
        bytes32 message,
        uint256 id,
        address issuer
    ) public view returns (bool) {
        Transaction memory trans = transactions[id];
        require(trans.issuer.id == issuer);

        address recoveredSigner = CryptoSuite.recoverSigner(
            message,
            trans.signature
        );

        return recoveredSigner == trans.issuer.id;
    }

    // To record transaction id to the entity and to the product
    // issuer.transactionIds[issuer.transactionIds.length] = transactionIds.length - 1;
    // Product memory product = products[productId];
    // product.transactionIds[product.transactionIds.length] = transactionIds.length - 1;

    function getTransactionIdsForEntity(address _issuer)
        public
        view
        returns (uint256[] memory)
    {
        Entity memory issuer = entities[_issuer];

        uint256[] memory _transactionIds = new uint256[](MAX_CERTIFICATIONS);
        uint256 numberOfTransactions = 0;
        uint256 arrayLength = transactionIds.length;

        for (uint256 i = 0; i < arrayLength; i++) {
            if (transactions[transactionIds[i]].issuer.id == issuer.id) {
                _transactionIds[numberOfTransactions] = transactionIds[i];
                numberOfTransactions++;
            }
        }
        // emit GetTransactionsForEntity(issuer.id, _transactionIds);

        return _transactionIds;
    }

    function getSemiProductId(uint256 productId) public view returns (uint256 id) {
        Product memory product = products[productId];
        return product.goods[0];
    }




}
