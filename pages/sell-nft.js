import Head from "next/head"
import styles from "../styles/Home.module.css"
// import Header from "../components/ManualHeader"
import nftMarketplaceAbi from "../contants/abi.json"
import nftAbi from "../contants/nftabi.json"
import { Form, useNotification, Button } from "web3uikit"
import { useMoralis, useWeb3Contract } from "react-moralis"
import { ethers } from "ethers"
import networkMapping from "../contants/networkMapping.json"
import { useEffect, useState } from "react"

export default function Home() {
    const dispatch = useNotification()
    const chainIds = `0x${Number(137).toString(16)}`

    const rpcURL = "https://polygon-rpc.com"
    const networkName = "Polygon Mainnet"
    const currencyName = "MATIC"
    const currencySymbol = "MATIC"
    const explorerURL = "https://polygonscan.com/"
    const addNetwork = async () => {
        try {
            if (!window.ethereum) {
                console.error("Metamask not detected")
                return
            }
            await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                    {
                        chainId: chainIds,
                        chainName: networkName,
                        rpcUrls: [rpcURL],
                        blockExplorerUrls: [explorerURL],
                        nativeCurrency: {
                            name: currencyName,
                            symbol: currencySymbol, // 2-6 characters long
                            decimals: 18,
                        },
                    },
                ],
            })
        } catch (err) {}
    }

    const { chainId, account, isWeb3Enabled } = useMoralis()
    const chainString = chainId ? parseInt(chainId).toString() : "137"
    if (chainString != "137") {
        addNetwork()
        console.log(`hexxxx is ${chainIds}`)
    } else {
        const marketplaceAddress = networkMapping[chainString].NftMarketplace[0]
        const [proceeds, setProceeds] = useState("0")

        const { runContractFunction } = useWeb3Contract()

        async function approveAndList(data) {
            console.log("Approving...")
            const nftAddress = data.data[0].inputResult
            const tokenId = data.data[1].inputResult
            const price = ethers.utils.parseUnits(data.data[2].inputResult, "ether").toString()

            const approveOptions = {
                abi: nftAbi,
                contractAddress: nftAddress,
                functionName: "approve",
                params: {
                    to: marketplaceAddress,
                    tokenId: tokenId,
                },
            }

            await runContractFunction({
                params: approveOptions,
                onSuccess: () => handleApproveSuccess(nftAddress, tokenId, price),
                onError: (error) => {
                    console.log(error)
                },
            })
        }

        async function handleApproveSuccess(nftAddress, tokenId, price) {
            console.log("Ok! Now time to list")
            const listOptions = {
                abi: nftMarketplaceAbi,
                contractAddress: marketplaceAddress,
                functionName: "listItem",
                params: {
                    nftAddress: nftAddress,
                    tokenId: tokenId,
                    price: price,
                },
            }

            await runContractFunction({
                params: listOptions,
                onSuccess: handleListSuccess,
                onError: (error) => console.log(error),
            })
        }

        async function handleListSuccess(tx) {
            await tx.wait(1)
            dispatch({
                type: "success",
                message: "NFT listing",
                title: "NFT listed",
                position: "topR",
            })
        }

        const handleWithdrawSuccess = async (tx) => {
            await tx.wait(1)
            dispatch({
                type: "success",
                message: "Withdrawing proceeds",
                position: "topR",
            })
        }

        async function setupUI() {
            const returnedProceeds = await runContractFunction({
                params: {
                    abi: nftMarketplaceAbi,
                    contractAddress: marketplaceAddress,
                    functionName: "getProceeds",
                    params: {
                        seller: account,
                    },
                },
                onError: (error) => console.log(error),
            })
            if (returnedProceeds) {
                setProceeds(returnedProceeds.toString())
            }
        }

        useEffect(() => {
            if (isWeb3Enabled) {
                setupUI()
            }
        }, [proceeds, account, isWeb3Enabled, chainId])

        return (
            <div className={styles.container}>
                <Form
                    onSubmit={approveAndList}
                    data={[
                        {
                            name: "NFT Address",
                            type: "text",
                            inputWidth: "50%",
                            value: "",
                            key: "nftAddress",
                        },
                        {
                            name: "Token ID",
                            type: "number",
                            value: "",
                            key: "tokenId",
                        },
                        {
                            name: "Price (in MATIC)",
                            type: "number",
                            value: "",
                            key: "price",
                        },
                    ]}
                    title="Sell your NFT!"
                    id="Main Form"
                />
                <div>Withdraw {proceeds} proceeds</div>
                {proceeds != "0" ? (
                    <Button
                        onClick={() => {
                            runContractFunction({
                                params: {
                                    abi: nftMarketplaceAbi,
                                    contractAddress: marketplaceAddress,
                                    functionName: "withdrawProceeds",
                                    params: {},
                                },
                                onError: (error) => console.log(error),
                                onSuccess: handleWithdrawSuccess,
                            })
                        }}
                        text="Withdraw"
                        type="button"
                    />
                ) : (
                    <div>No proceeds detected</div>
                )}
            </div>
        )
    }
}
