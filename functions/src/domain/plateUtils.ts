/**
 * Tiện ích xử lý biển số xe Việt Nam cho Backend Cloud.
 */
export class PlateUtils {
  private static readonly PLATE_REGEX = /^[0-9]{2}[A-Z][0-9A-Z]?[0-9]{4,6}$/;
  private static readonly SPECIAL_PLATE_REGEX = /^(NG|NN|QT|KT|HC|CD|MK|TD)[0-9]{3,5}$/;

  /**
   * Chuẩn hóa biển số xe: bỏ ký tự đặc biệt, viết hoa.
   * normalize("51A-123.45") → "51A12345"
   */
  public static normalize(plate: string): string {
    if (!plate) return "";
    return plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  /**
   * Kiểm tra biển số xe có hợp lệ hay không.
   */
  public static isValid(normalizedPlate: string): boolean {
    if (!normalizedPlate) return false;
    return (
      PlateUtils.PLATE_REGEX.test(normalizedPlate) ||
      PlateUtils.SPECIAL_PLATE_REGEX.test(normalizedPlate)
    );
  }

  /**
   * Chuẩn hóa và kiểm tra tính hợp lệ.
   */
  public static normalizeAndValidate(plate: string): string | null {
    const normalized = PlateUtils.normalize(plate);
    return PlateUtils.isValid(normalized) ? normalized : null;
  }

  /**
   * Định dạng hiển thị biển số xe ("51A12345" → "51A-123.45").
   */
  public static formatDisplay(normalizedPlate: string): string {
    if (!normalizedPlate || normalizedPlate.length < 7) return normalizedPlate;
    const prefix = normalizedPlate.substring(0, 3);
    const mid = normalizedPlate.substring(3, normalizedPlate.length - 2);
    const suffix = normalizedPlate.substring(normalizedPlate.length - 2);
    return `${prefix}-${mid}.${suffix}`;
  }
}

