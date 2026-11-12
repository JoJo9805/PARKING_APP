package com.iotparking.app

import com.iotparking.app.core.domain.PlateUtils
import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

class PlateUtilsTest {

    @Test
    fun testPlateCasesAgainstContract() {
        val fileCandidates = listOf(
            File("../../contracts/plate_test_cases.json"),
            File("../contracts/plate_test_cases.json"),
            File("contracts/plate_test_cases.json")
        )
        val contractFile = fileCandidates.firstOrNull { it.exists() }

        if (contractFile != null) {
            val jsonContent = contractFile.readText()
            val array = JSONArray(jsonContent)

            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val raw = obj.getString("raw")
                val expectedNorm = obj.getString("expectedNormalized")
                val isValid = obj.getBoolean("isValid")
                val desc = obj.optString("description")

                val normalized = PlateUtils.normalize(raw)
                val valid = PlateUtils.isValid(normalized)

                assertEquals("[$desc] Sai normalized", expectedNorm, normalized)
                assertEquals("[$desc] Sai isValid", isValid, valid)
            }
        } else {
            assertEquals("51A12345", PlateUtils.normalize("51A-123.45"))
            assertEquals(true, PlateUtils.isValid("51A12345"))
            assertEquals(true, PlateUtils.isValid("29C199988"))
        }
    }
}

