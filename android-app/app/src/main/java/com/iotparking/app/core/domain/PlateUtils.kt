package com.iotparking.app.core.domain

/**
 * Tiện ích xử lý biển số xe Việt Nam.
 */
object PlateUtils {

    /**
     * Regex cho biển số xe Việt Nam chuẩn hóa (đã bỏ ký tự đặc biệt).
     * Ví dụ:
     * - Ô tô: 51A12345, 30H00001, 43A1234 (4 hoặc 5 số)
     * - Xe máy: 29C199988, 59X212345 (seri 2 ký tự ví dụ C1, X2 hoặc 1 ký tự ví dụ C)
     * Bao gồm:
     * - 2 chữ số tỉnh/thành
     * - 1 chữ cái hoặc 1 chữ + 1 số (seri xe máy) hoặc 2 chữ
     * - 4-6 chữ số
     */
    private val PLATE_REGEX = Regex("^[0-9]{2}[A-Z][0-9A-Z]?[0-9]{4,6}$")

    /**
     * Regex cho biển số xe đặc biệt (quân đội, ngoại giao, v.v.)
     * Ví dụ: NG12345, NN12345
     */
    private val SPECIAL_PLATE_REGEX = Regex("^(NG|NN|QT|KT|HC|CD|MK|TD)[0-9]{3,5}$")

    /**
     * Chuẩn hóa biển số xe: bỏ ký tự đặc biệt, viết hoa.
     * normalize("51A-123.45") → "51A12345"
     * normalize("30h-000.01") → "30H00001"
     *
     * @param plate Biển số xe gốc
     * @return Biển số xe chuẩn hóa
     */
    fun normalize(plate: String): String {
        return plate
            .uppercase()
            .replace(Regex("[^A-Z0-9]"), "")
    }

    /**
     * Kiểm tra biển số xe Việt Nam có hợp lệ hay không.
     *
     * @param normalizedPlate Biển số xe đã chuẩn hóa
     * @return true nếu hợp lệ
     */
    fun isValid(normalizedPlate: String): Boolean {
        return PLATE_REGEX.matches(normalizedPlate) || SPECIAL_PLATE_REGEX.matches(normalizedPlate)
    }

    /**
     * Chuẩn hóa và kiểm tra tính hợp lệ.
     *
     * @param plate Biển số xe gốc
     * @return Biển số xe chuẩn hóa nếu hợp lệ, null nếu không hợp lệ
     */
    fun normalizeAndValidate(plate: String): String? {
        val normalized = normalize(plate)
        return if (isValid(normalized)) normalized else null
    }

    /**
     * Định dạng hiển thị biển số xe.
     * "51A12345" → "51A-123.45"
     *
     * @param normalizedPlate Biển số xe đã chuẩn hóa
     * @return Biển số xe định dạng hiển thị
     */
    fun formatDisplay(normalizedPlate: String): String {
        if (normalizedPlate.length < 7) return normalizedPlate
        val prefix = normalizedPlate.substring(0, 3)
        val mid = normalizedPlate.substring(3, normalizedPlate.length - 2)
        val suffix = normalizedPlate.substring(normalizedPlate.length - 2)
        return "$prefix-$mid.$suffix"
    }
}
