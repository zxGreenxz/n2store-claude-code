import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { Download } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ExportProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProducts?: any[]; // Products currently displayed
}

export function ExportProductsDialog({
  open,
  onOpenChange,
  currentProducts = []
}: ExportProductsDialogProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportScope, setExportScope] = useState<"current" | "all">("current");
  const [exportFormat, setExportFormat] = useState<"flat" | "grouped">("flat");

  const formatCurrency = (value: number | null): string => {
    if (value === null || value === undefined) return "";
    return value.toLocaleString("vi-VN");
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString("vi-VN");
    } catch {
      return dateString;
    }
  };

  const exportFlat = (products: any[]) => {
    // Export all products as flat list (one row per product/variant)
    const exportData = products.map(product => ({
      "Mã sản phẩm": product.product_code || "",
      "Tên sản phẩm": product.product_name || "",
      "Mã sản phẩm gốc": product.base_product_code || "",
      "Biến thể": product.variant || "",
      "Loại": product.product_code === product.base_product_code ? "Sản phẩm gốc" : "Biến thể",
      "Giá bán": formatCurrency(product.selling_price),
      "Giá mua": formatCurrency(product.purchase_price),
      "Tồn kho": product.stock_quantity || 0,
      "Khả dụng": product.virtual_available || 0,
      "Đơn vị": product.unit || "",
      "Nhóm sản phẩm": product.category || "",
      "Nhà cung cấp": product.supplier_name || "",
      "Mã vạch": product.barcode || "",
      "TPOS ID": product.tpos_product_id || "",
      "Ngày tạo": formatDate(product.created_at),
      "Cập nhật": formatDate(product.updated_at),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Mã sản phẩm
      { wch: 40 }, // Tên sản phẩm
      { wch: 15 }, // Mã sản phẩm gốc
      { wch: 15 }, // Biến thể
      { wch: 15 }, // Loại
      { wch: 12 }, // Giá bán
      { wch: 12 }, // Giá mua
      { wch: 10 }, // Tồn kho
      { wch: 10 }, // Khả dụng
      { wch: 10 }, // Đơn vị
      { wch: 20 }, // Nhóm sản phẩm
      { wch: 20 }, // Nhà cung cấp
      { wch: 15 }, // Mã vạch
      { wch: 10 }, // TPOS ID
      { wch: 12 }, // Ngày tạo
      { wch: 12 }, // Cập nhật
    ];

    return ws;
  };

  const exportGrouped = (products: any[]) => {
    // Group products by base_product_code
    const grouped = new Map<string, any[]>();

    products.forEach(product => {
      const baseCode = product.base_product_code || product.product_code;
      if (!grouped.has(baseCode)) {
        grouped.set(baseCode, []);
      }
      grouped.get(baseCode)!.push(product);
    });

    const exportData: any[] = [];

    grouped.forEach((group, baseCode) => {
      // Find parent product (where product_code === base_product_code)
      const parent = group.find(p => p.product_code === p.base_product_code) || group[0];
      const variants = group.filter(p => p.product_code !== p.base_product_code);

      // Add parent row
      exportData.push({
        "Mã SP gốc": parent.product_code,
        "Tên sản phẩm": parent.product_name,
        "Loại": "Sản phẩm gốc",
        "Biến thể": parent.variant || "",
        "Giá bán": formatCurrency(parent.selling_price),
        "Giá mua": formatCurrency(parent.purchase_price),
        "Tồn kho": parent.stock_quantity || 0,
        "Khả dụng": parent.virtual_available || 0,
        "Đơn vị": parent.unit || "",
        "Nhóm": parent.category || "",
        "NCC": parent.supplier_name || "",
        "Mã vạch": parent.barcode || "",
        "Số biến thể": variants.length,
      });

      // Add variant rows
      variants.forEach((variant, index) => {
        exportData.push({
          "Mã SP gốc": baseCode,
          "Tên sản phẩm": variant.product_name,
          "Loại": `  ↳ Biến thể ${index + 1}`,
          "Biến thể": variant.variant || "",
          "Giá bán": formatCurrency(variant.selling_price),
          "Giá mua": formatCurrency(variant.purchase_price),
          "Tồn kho": variant.stock_quantity || 0,
          "Khả dụng": variant.virtual_available || 0,
          "Đơn vị": variant.unit || "",
          "Nhóm": variant.category || "",
          "NCC": variant.supplier_name || "",
          "Mã vạch": variant.barcode || "",
          "Số biến thể": "",
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Mã SP gốc
      { wch: 40 }, // Tên sản phẩm
      { wch: 15 }, // Loại
      { wch: 15 }, // Biến thể
      { wch: 12 }, // Giá bán
      { wch: 12 }, // Giá mua
      { wch: 10 }, // Tồn kho
      { wch: 10 }, // Khả dụng
      { wch: 10 }, // Đơn vị
      { wch: 20 }, // Nhóm
      { wch: 20 }, // NCC
      { wch: 15 }, // Mã vạch
      { wch: 12 }, // Số biến thể
    ];

    return ws;
  };

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);

    try {
      let productsToExport: any[] = [];

      if (exportScope === "current") {
        // Use currently displayed products
        productsToExport = currentProducts;
        setProgress(50);
      } else {
        // Fetch all products from database
        setProgress(10);
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("base_product_code", { ascending: true })
          .order("product_code", { ascending: true });

        if (error) throw error;
        productsToExport = data || [];
        setProgress(50);
      }

      if (productsToExport.length === 0) {
        toast({
          title: "Không có dữ liệu",
          description: "Không có sản phẩm nào để export",
          variant: "destructive",
        });
        setIsExporting(false);
        return;
      }

      setProgress(70);

      // Create worksheet based on format
      const ws = exportFormat === "flat"
        ? exportFlat(productsToExport)
        : exportGrouped(productsToExport);

      setProgress(90);

      // Create workbook and export
      const wb = XLSX.utils.book_new();
      const sheetName = exportFormat === "flat" ? "Sản phẩm" : "SP + Biến thể";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const fileName = `products_export_${exportFormat}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      setProgress(100);

      toast({
        title: "Export thành công",
        description: `Đã export ${productsToExport.length} sản phẩm vào file ${fileName}`,
      });

      onOpenChange(false);
      setProgress(0);
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Lỗi",
        description: "Không thể export dữ liệu. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export sản phẩm ra Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Scope */}
          <div className="space-y-3">
            <Label>Phạm vi export</Label>
            <RadioGroup value={exportScope} onValueChange={(value: any) => setExportScope(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="current" id="scope-current" />
                <Label htmlFor="scope-current" className="font-normal cursor-pointer">
                  Danh sách hiện tại ({currentProducts.length} sản phẩm)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="scope-all" />
                <Label htmlFor="scope-all" className="font-normal cursor-pointer">
                  Tất cả sản phẩm trong hệ thống
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Export Format */}
          <div className="space-y-3">
            <Label>Định dạng export</Label>
            <RadioGroup value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="flat" id="format-flat" />
                <Label htmlFor="format-flat" className="font-normal cursor-pointer">
                  <div>
                    <div className="font-medium">Danh sách phẳng</div>
                    <div className="text-xs text-muted-foreground">
                      Mỗi sản phẩm/biến thể là 1 dòng riêng
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="grouped" id="format-grouped" />
                <Label htmlFor="format-grouped" className="font-normal cursor-pointer">
                  <div>
                    <div className="font-medium">Nhóm theo sản phẩm gốc</div>
                    <div className="text-xs text-muted-foreground">
                      Sản phẩm gốc + các biến thể theo nhóm
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Progress */}
          {isExporting && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                Đang export... {Math.round(progress)}%
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
            >
              Hủy
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Đang export..." : "Export Excel"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
