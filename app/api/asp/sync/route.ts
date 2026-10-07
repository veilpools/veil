import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "@/lib/chains";
import { createBypassTransport } from "@/lib/rpc-transport";
import { TESTNET_0XBOW, TESTNET_CHAIN_ID } from "@/lib/privacy-pools";
import { fetchBowPoolEvents } from "@/lib/0xbow-client";
import { buildBowAssociationSet } from "@/lib/0xbow-association";

const ENTRYPOINT_ABI = [
  {
    type: "function",
    name: "updateRoot",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_root", type: "uint256" },
      { name: "_ipfsCID", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "latestRoot",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chainId = Number(searchParams.get("chainId") || TESTNET_CHAIN_ID);
    if (chainId !== TESTNET_CHAIN_ID) {
      return NextResponse.json({ error: "Only testnet 46630 supported for ASP auto-sync" }, { status: 400 });
    }

    const publicClient = createPublicClient({
      chain: robinhoodTestnet,
      transport: createBypassTransport(TESTNET_CHAIN_ID),
    });

    const { labels, depositLogs } = await fetchBowPoolEvents(publicClient as any, TESTNET_0XBOW.pool);
    const aspSet = buildBowAssociationSet(labels);
    const onchainRoot = await publicClient.readContract({
      address: TESTNET_0XBOW.entrypointProxy,
      abi: ENTRYPOINT_ABI,
      functionName: "latestRoot",
    });

    const isCurrent = BigInt(onchainRoot) === aspSet.root;
    return NextResponse.json({
      success: true,
      chainId,
      labelCount: labels.length,
      depositCount: depositLogs.length,
      computedRoot: aspSet.root.toString(),
      onchainRoot: onchainRoot.toString(),
      isCurrent,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to inspect ASP root" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const chainId = Number(body.chainId || TESTNET_CHAIN_ID);
    if (chainId !== TESTNET_CHAIN_ID) {
      return NextResponse.json({ error: "Only testnet 46630 supported for ASP auto-sync" }, { status: 400 });
    }

    const rawKey = (process.env.PRIVATE_KEY || "").trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(rawKey)) {
      return NextResponse.json(
        { success: false, error: "Postman private key not configured on server" },
        { status: 500 }
      );
    }

    const publicClient = createPublicClient({
      chain: robinhoodTestnet,
      transport: createBypassTransport(TESTNET_CHAIN_ID),
    });

    const { labels, depositLogs } = await fetchBowPoolEvents(publicClient as any, TESTNET_0XBOW.pool);
    const aspSet = buildBowAssociationSet(labels);
    const onchainRoot = await publicClient.readContract({
      address: TESTNET_0XBOW.entrypointProxy,
      abi: ENTRYPOINT_ABI,
      functionName: "latestRoot",
    });

    if (BigInt(onchainRoot) === aspSet.root) {
      return NextResponse.json({
        success: true,
        updated: false,
        message: "ASP root is already up-to-date",
        root: aspSet.root.toString(),
        labelCount: labels.length,
        depositCount: depositLogs.length,
      });
    }

    const account = privateKeyToAccount(rawKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: robinhoodTestnet,
      transport: createBypassTransport(TESTNET_CHAIN_ID),
    });

    const head = await publicClient.getBlockNumber();
    const cid = `auto-asp-46630-b${head}-l${labels.length}`.padEnd(33, "0");

    const txHash = await walletClient.writeContract({
      address: TESTNET_0XBOW.entrypointProxy,
      abi: ENTRYPOINT_ABI,
      functionName: "updateRoot",
      args: [aspSet.root, cid],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error(`updateRoot transaction reverted: ${txHash}`);
    }

    return NextResponse.json({
      success: true,
      updated: true,
      txHash,
      blockNumber: receipt.blockNumber.toString(),
      root: aspSet.root.toString(),
      labelCount: labels.length,
      depositCount: depositLogs.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to sync ASP root" },
      { status: 500 }
    );
  }
}
