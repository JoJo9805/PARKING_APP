package com.iotparking.app

import com.iotparking.app.core.domain.FeeCalculator
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

class FeeCalculatorTest {

    @Test
    fun testFeeCasesAgainstContract() {
        // Tìm file contracts/fee_test_cases.json
        val fileCandidates = listOf(
            File("../../contracts/fee_test_cases.json"),
            File("../contracts/fee_test_cases.json"),
            File("contracts/fee_test_cases.json")
        )
        val contractFile = fileCandidates.firstOrNull { it.exists() }

        if (contractFile != null) {
            val jsonContent = contractFile.readText()
            val array = JSONArray(jsonContent)

            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val desc = obj.optString("description")
                val durationMin = obj.getInt("durationMin")
                val graceMinutes = obj.getInt("graceMinutes")
                val blockMinutes = obj.getInt("blockMinutes")
                val pricePerBlock = obj.getLong("pricePerBlock")
                val depositApplied = obj.getLong("depositApplied")

                val expectedFee = obj.getLong("expectedFee")
                val expectedRefund = obj.getLong("expectedDepositRefund")
                val expectedCharged = obj.getLong("expectedAmountCharged")

                val result = FeeCalculator.calculateFee(
                    durationMin = durationMin,
                    graceMinutes = graceMinutes,
                    blockMinutes = blockMinutes,
                    pricePerBlock = pricePerBlock,
                    depositApplied = depositApplied
                )

                assertEquals("[$desc] Sai fee", expectedFee, result.fee)
                assertEquals("[$desc] Sai depositRefund", expectedRefund, result.depositRefund)
                assertEquals("[$desc] Sai amountCharged", expectedCharged, result.amountCharged)
            }
        } else {
            // Direct test assertions
            val res1 = FeeCalculator.calculateFee(10, 0, 30, 5000L, 5000L)
            assertEquals(5000L, res1.fee)
            assertEquals(0L, res1.depositRefund)
            assertEquals(0L, res1.amountCharged)

            val res2 = FeeCalculator.calculateFee(3, 5, 30, 5000L, 5000L)
            assertEquals(0L, res2.fee)
            assertEquals(5000L, res2.depositRefund)
            assertEquals(0L, res2.amountCharged)
        }
    }
}

