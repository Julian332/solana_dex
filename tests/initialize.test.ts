import * as anchor from "@coral-xyz/anchor";
import {BN, Program} from "@coral-xyz/anchor";
import {Soldium} from "../target/types/soldium";

import {getAccount, TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {calculateFee, initialize, setupInitializeTest} from "./utils";
import {assert} from "chai";

describe("initialize test", () => {
    anchor.setProvider(anchor.AnchorProvider.env());
    const owner = anchor.Wallet.local().payer;
    console.log("owner: ", owner.publicKey.toString());

    const program = anchor.workspace.Soldium as Program<Soldium>;

    const confirmOptions = {
        skipPreflight: true,
    };

    it("create pool without fee", async () => {
        const {configAddress, token0, token0Program, token1, token1Program} =
            await setupInitializeTest(
                program,
                anchor.getProvider().connection,
                owner,
                {
                    config_index: 0,
                    tradeFeeRate: new BN(10),
                    protocolFeeRate: new BN(1000),
                    fundFeeRate: new BN(25000),
                    create_fee: new BN(0),
                },
                {transferFeeBasisPoints: 0, MaxFee: 0},
                confirmOptions
            );

        const initAmount0 = new BN(10000000000);
        const initAmount1 = new BN(10000000000);
        const {poolAddress, poolState} = await initialize(
            program,
            owner,
            configAddress,
            token0,
            token0Program,
            token1,
            token1Program,
            confirmOptions,
            {initAmount0, initAmount1}
        );
        let vault0 = await getAccount(
            anchor.getProvider().connection,
            poolState.token0Vault,
            "processed",
            poolState.token0Program
        );
        assert.equal(vault0.amount.toString(), initAmount0.toString());

        let vault1 = await getAccount(
            anchor.getProvider().connection,
            poolState.token1Vault,
            "processed",
            poolState.token1Program
        );
        assert.equal(vault1.amount.toString(), initAmount1.toString());
    });

    it("create pool with fee", async () => {

        const {configAddress, token0, token0Program, token1, token1Program} =
            await setupInitializeTest(
                program,
                anchor.getProvider().connection,
                owner,
                {
                    config_index: 1,
                    tradeFeeRate: new BN(10),
                    protocolFeeRate: new BN(1000),
                    fundFeeRate: new BN(25000),
                    create_fee: new BN(100000000),
                },
                {transferFeeBasisPoints: 0, MaxFee: 0},
                confirmOptions
            );
        const initAmount0 = new BN(10000000000);
        const initAmount1 = new BN(10000000000);
        const {poolAddress, poolState} = await initialize(
            program,
            owner,
            configAddress,
            token0,
            token0Program,
            token1,
            token1Program,
            confirmOptions,
            {initAmount0, initAmount1}
        );

        let vault0 = await getAccount(
            anchor.getProvider().connection,
            poolState.token0Vault,
            "processed",
            poolState.token0Program
        );
        assert.equal(vault0.amount.toString(), initAmount0.toString());

        let vault1 = await getAccount(
            anchor.getProvider().connection,
            poolState.token1Vault,
            "processed",
            poolState.token1Program
        );
        assert.equal(vault1.amount.toString(), initAmount1.toString());
    });

    it("create pool with token2022 mint has transfer fee", async () => {
        const transferFeeConfig = {transferFeeBasisPoints: 100, MaxFee: 50000000}; // %10
        const {configAddress, token0, token0Program, token1, token1Program} =
            await setupInitializeTest(
                program,
                anchor.getProvider().connection,
                owner,
                {
                    config_index: 1,
                    tradeFeeRate: new BN(10),
                    protocolFeeRate: new BN(1000),
                    fundFeeRate: new BN(25000),
                    create_fee: new BN(100000000),
                },
                {transferFeeBasisPoints: 100, MaxFee: 50000000},
                confirmOptions
            );

        const initAmount0 = new BN(10000000000);
        const initAmount1 = new BN(10000000000);
        const {poolAddress, poolState} = await initialize(
            program,
            owner,
            configAddress,
            token0,
            token0Program,
            token1,
            token1Program,
            confirmOptions,
            {initAmount0, initAmount1}
        );
        let vault0 = await getAccount(
            anchor.getProvider().connection,
            poolState.token0Vault,
            "processed",
            poolState.token0Program
        );
        if (token0Program == TOKEN_PROGRAM_ID) {
            assert.equal(vault0.amount.toString(), initAmount0.toString());
        } else {
            const total =
                vault0.amount +
                calculateFee(
                    transferFeeConfig,
                    BigInt(initAmount0.toString()),
                    poolState.token0Program
                );
            assert(new BN(total.toString()).gte(initAmount0));
        }

        let vault1 = await getAccount(
            anchor.getProvider().connection,
            poolState.token1Vault,
            "processed",
            poolState.token1Program
        );
        if (token1Program == TOKEN_PROGRAM_ID) {
            assert.equal(vault1.amount.toString(), initAmount1.toString());
        } else {
            const total =
                vault1.amount +
                calculateFee(
                    transferFeeConfig,
                    BigInt(initAmount1.toString()),
                    poolState.token1Program
                );
            assert(new BN(total.toString()).gte(initAmount1));
        }
    });
});
