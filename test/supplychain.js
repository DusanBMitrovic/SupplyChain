const { expectEvent, BN } = require("@openzeppelin/test-helpers");
const HDWalletProvider = require("@truffle/hdwallet-provider");
const Web3 = require("web3");



const SupplyChain = artifacts.require("SupplyChain");


contract('SupplyChain', (accounts) => {

    before(async () => {


        this.owner = accounts[0];

        this.PRODUCT_NAMES = {
            Silk: "Silk",
            Cotton: "Cotton",
            Texas: "Texas",
            Shirt: "Shirt",
            Shoes: "Shoes",
            Jacket: "Jacket",
            Jeans: "Jeans"
        };

        this.RoleEnums = {
            SUPPLIER: { val: "SUPPLIER", pos: 0 },
            MANUFACTURER: { val: "MANUFACTURER", pos: 1 },
            TRANSPORTER: { val: "TRANSPORTER", pos: 2 },
            DISTRIBUTER: { val: "DISTRIBUTER", pos: 3 },
            RETAILER: { val: "RETAILER", pos: 4 },
            CUSTOMER: { val: "CUSTOMER", pos: 5 }
        };

        this.StatusEnums = {
            manufacturing: { val: "MANUFACTURING", pos: 0 },
            manufactured: { val: "MANUFACTURED", pos: 1 },
            in_transport: { val: "IN_TRANSPORT", pos: 2 },
            stored: { val: "STORED", pos: 3 },
            used: { val: "USED", pos: 4 },
        };

        this.defaultEntitites = {
            // supplierA: { id: accounts[1], role: this.RoleEnums.SUPPLIER.val },
            manufacturerA: { id: accounts[1], role: this.RoleEnums.MANUFACTURER.val },
            manufacturerB: { id: accounts[2], role: this.RoleEnums.MANUFACTURER.val },
            transporterA: { id: accounts[3], role: this.RoleEnums.TRANSPORTER.val },
            distributor: { id: accounts[4], role: this.RoleEnums.DISTRIBUTER.val },
            distributorLocal: { id: accounts[5], role: this.RoleEnums.DISTRIBUTER.val },
            retailerA: { id: accounts[6], role: this.RoleEnums.RETAILER.val },
            retailerB: { id: accounts[7], role: this.RoleEnums.RETAILER.val },
            customer: { id: accounts[8], role: this.RoleEnums.CUSTOMER.val }
        };

        this.defaultProducts = {
            0: { name: this.PRODUCT_NAMES.Cotton, manufacturer: this.defaultEntitites.manufacturerA.id },
            1: { name: this.PRODUCT_NAMES.Silk, manufacturer: this.defaultEntitites.manufacturerA.id },
            2: { name: this.PRODUCT_NAMES.Texas, manufacturer: this.defaultEntitites.manufacturerA.id },
            3: { name: this.PRODUCT_NAMES.Shirt, manufacturer: this.defaultEntitites.manufacturerB.id },
            4: { name: this.PRODUCT_NAMES.Jeans, manufacturer: this.defaultEntitites.manufacturerB.id },
            5: { name: this.PRODUCT_NAMES.Shirt, manufacturer: this.defaultEntitites.manufacturerA.id },
            6: { name: this.PRODUCT_NAMES.Shoes, manufacturer: this.defaultEntitites.manufacturerA.id },
            7: { name: this.PRODUCT_NAMES.Shoes, manufacturer: this.defaultEntitites.manufacturerB.id },
            8: { name: this.PRODUCT_NAMES.Jacket, manufacturer: this.defaultEntitites.manufacturerB.id },
            9: { name: this.PRODUCT_NAMES.Shirt, manufacturer: this.defaultEntitites.manufacturerA.id }
        };

        this.supplyChainInstance = await SupplyChain.deployed();
    });

    it('should add entities successfully', async () => {

        for (const entity in this.defaultEntitites) {
            const { id, role } = this.defaultEntitites[entity];

            const result = await this.supplyChainInstance.addEntity(
                id,
                role,
                { from: this.owner }
            );


            expectEvent(result.receipt, "AddEntity", {
                entityId: id,
                entityRole: role
            });
            const retrievedEntity = await this.supplyChainInstance.entities.call(id);



            console.log(this.supplyChainInstance.entities);

            assert.equal(id, retrievedEntity.id, "missmatched ids");
            assert.equal(this.RoleEnums[role].pos, retrievedEntity.role.toString(), "missmatched role");
        }
    });

    it('should add products successfully', async () => {

        for (let i = 0; i < Object.keys(this.defaultProducts).length; i++) {

            const { name, manufacturer } = this.defaultProducts[i];

            const result = await this.supplyChainInstance.addProduct(
                name,
                manufacturer,
                100,
                { from: this.owner }
            );

            expectEvent(result.receipt, "AddProduct", {
                productId: String(i),
                manufacturer: manufacturer
            });
            const retrievedProduct = await this.supplyChainInstance.products.call(i);

            assert.equal(i, retrievedProduct.id);
            assert.equal(name, retrievedProduct.name);
            assert.equal(manufacturer, retrievedProduct.manufacturer);
            assert.equal(undefined, retrievedProduct._goods);
            assert.equal(undefined, retrievedProduct._transactionIds);
        };
    });

    // First interaction: ManufacturerA - TransporterA
    it('should sign a message and store it as a transaction from the issuer to a reciver', async () => {

        const mnemonic = "draft suit alpha truck region load genius firm mystery flash churn lecture";
        providerOrUrl = "http://localhost:8545";
        const provider = new HDWalletProvider({
            mnemonic,
            providerOrUrl
        });
        this.web3 = new Web3(provider);

        const { manufacturerA, transporterA } = this.defaultEntitites;
        const productId = 0;
        // const message = `TransporterA (${transporterA.id}) has received product #${productId} and issued transaction document to (${manufacturerA.id})`;
        const message = `ManufacturerA (${manufacturerA.id}) has issued transaction document to (${transporterA.id}) for product #${productId}`;
        const signature = await this.web3.eth.sign(
            this.web3.utils.keccak256(message),
            manufacturerA.id
        );

        const result = await this.supplyChainInstance.issueTransaction(
            manufacturerA.id,
            transporterA.id,
            this.StatusEnums.in_transport.val,
            productId,
            signature,
            { from: this.owner }
        );

        expectEvent(result.receipt, "IssueTransaction", {
            issuer: manufacturerA.id,
            receiver: transporterA.id,
            transactionId: new BN(0)
        });

        const retrievedTransaction = await this.supplyChainInstance.transactions.call(0);

        assert.equal(retrievedTransaction.id, 0);
        assert.equal(retrievedTransaction.issuer["id"], manufacturerA.id);
        assert.equal(retrievedTransaction.receiver["id"], transporterA.id);
        assert.equal(retrievedTransaction.signature, signature);
        // assert.equal(retrievedTransaction.status, this.StatusEnums.in_transport.pos.toString());
    });

    // Second interaction: TransporterA - ManufacturerB
    // ManufacturerB should verify if the trnsaction document is signed by the real manufacturer
    it('should verify that the transaction signature matches the issuer', async () => {
        const { manufacturerA, transporterA } = this.defaultEntitites;
        const productId = 0;
        const message = `ManufacturerA (${manufacturerA.id}) has issued transaction document to (${transporterA.id}) for product #${productId}`;

        // transaction that should be matched with
        const transaction = await this.supplyChainInstance.transactions.call(0);

        const signerMatches = await this.supplyChainInstance.isMatchingSignature(
            this.web3.utils.keccak256(message),
            transaction.id,
            manufacturerA.id,
            { from: this.owner }
        );

        assert.equal(signerMatches, true);
    });

    // ManufacturerB creates new product and use Product from ManufacturerA as a material(semi-product)
    // it('ManufacturerB should add product successfully and use product0 as semi product', async () => {
    it('should successfully verify that the product details and all of the provenance details are available on the network', async () => {
        const semiProductId = 0;
        const productName = "Shirt";
        const manufacturer = this.defaultEntitites.manufacturerB.id;

        const result = await this.supplyChainInstance.addProduct(
            productName,
            manufacturer,
            semiProductId,
            { from: this.owner }
        );

        const newProductId = 10;

        expectEvent(result.receipt, "AddProduct", {
            productId: String(newProductId),
            manufacturer: manufacturer
        });
    });

});
