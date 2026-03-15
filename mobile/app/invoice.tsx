import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/lib/supabase";
import * as Haptics from "expo-haptics";

// ── Types ─────────────────────────────────────────────────────────────────────

type LineItem = {
  id: string;
  description: string;
  qty: string;
  unitPrice: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const getTodayStr = (): string => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const getDueDateStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const parseNum = (s: string): number => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
};

const formatCurrency = (n: number): string =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function InvoiceScreen() {
  const router = useRouter();

  // Installer / business details
  const [businessName, setBusinessName] = useState("");
  const [businessABN, setBusinessABN] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");

  // Client details
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  // Invoice details
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [invoiceDate, setInvoiceDate] = useState(getTodayStr());
  const [dueDate, setDueDate] = useState(getDueDateStr());
  const [jobReference, setJobReference] = useState("");
  const [notes, setNotes] = useState("");
  const [gstIncluded, setGstIncluded] = useState(true);

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", description: "", qty: "1", unitPrice: "" },
  ]);

  // State
  const [pdfLoading, setPdfLoading] = useState(false);

  // ── Pre-fill from profile ─────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && active) {
            const { data } = await supabase
              .from("profiles")
              .select("full_name, licence_number, company_name")
              .eq("user_id", user.id)
              .single();
            if (data && active) {
              if (data.company_name) setBusinessName(data.company_name);
              if (data.licence_number) setLicenceNumber(data.licence_number);
            }
          }
        } catch {}
        // Pre-fill job reference from current job
        try {
          const raw = await AsyncStorage.getItem("elemetric_current_job");
          if (raw && active) {
            const j = JSON.parse(raw);
            if (j.jobName) setJobReference(j.jobName);
            if (j.jobAddr) setClientAddress(j.jobAddr);
          }
        } catch {}
      })();
      return () => { active = false; };
    }, [])
  );

  // ── Line item operations ──────────────────────────────────────────────────

  const addLine = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLineItems((prev) => [
      ...prev,
      { id: String(Date.now()), description: "", qty: "1", unitPrice: "" },
    ]);
  };

  const removeLine = (id: string) => {
    setLineItems((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, field: keyof LineItem, value: string) => {
    setLineItems((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  // ── Totals ────────────────────────────────────────────────────────────────

  const subtotal = lineItems.reduce(
    (sum, l) => sum + parseNum(l.qty) * parseNum(l.unitPrice),
    0
  );
  const gstAmount = gstIncluded ? subtotal * 0.1 : 0;
  const total = subtotal + gstAmount;

  // ── PDF generation ───────────────────────────────────────────────────────

  const generatePdf = async () => {
    if (!clientName.trim()) {
      Alert.alert("Required", "Please enter the client name.");
      return;
    }
    if (lineItems.every((l) => !l.description.trim())) {
      Alert.alert("Required", "Please add at least one line item.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPdfLoading(true);
    try {
      const lineRows = lineItems
        .filter((l) => l.description.trim())
        .map(
          (l) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${l.description}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${l.qty}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(parseNum(l.unitPrice))}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatCurrency(parseNum(l.qty) * parseNum(l.unitPrice))}</td>
          </tr>`
        )
        .join("");

      const html = `<html><head><style>
@page { margin: 15mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; color: #6b7280; } }
body { margin: 0; padding: 0; font-family: Helvetica, Arial, sans-serif; color: #111827; }
</style></head><body>

<!-- Header -->
<div style="background:#07152b;color:white;padding:24px 28px;display:flex;justify-content:space-between;align-items:flex-start;">
  <div>
    <div style="font-size:30px;font-weight:900;letter-spacing:3px;color:#f97316;">ELEMETRIC</div>
    <div style="font-size:11px;opacity:0.55;margin-top:2px;">AI-Powered Compliance Documentation</div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:26px;font-weight:900;color:white;letter-spacing:1px;">INVOICE</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.65);margin-top:4px;">${invoiceNumber}</div>
  </div>
</div>
<div style="background:#f97316;height:4px;"></div>

<div style="padding:28px;">

  <!-- From / To -->
  <div style="display:flex;justify-content:space-between;margin-bottom:28px;gap:20px;">
    <div style="flex:1;">
      <div style="font-size:10px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">From</div>
      ${businessName ? `<div style="font-size:16px;font-weight:700;margin-bottom:4px;">${businessName}</div>` : ""}
      ${businessABN ? `<div style="font-size:12px;color:#6b7280;">ABN ${businessABN}</div>` : ""}
      ${licenceNumber ? `<div style="font-size:12px;color:#6b7280;">Licence: ${licenceNumber}</div>` : ""}
      ${businessAddress ? `<div style="font-size:13px;margin-top:4px;">${businessAddress}</div>` : ""}
      ${businessPhone ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${businessPhone}</div>` : ""}
      ${businessEmail ? `<div style="font-size:12px;color:#6b7280;">${businessEmail}</div>` : ""}
    </div>
    <div style="flex:1;">
      <div style="font-size:10px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">To</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:4px;">${clientName}</div>
      ${clientAddress ? `<div style="font-size:13px;margin-top:4px;">${clientAddress}</div>` : ""}
      ${clientEmail ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${clientEmail}</div>` : ""}
    </div>
    <div>
      <div style="font-size:10px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Invoice Details</div>
      <table style="border-collapse:collapse;">
        <tr><td style="padding:3px 8px 3px 0;font-size:12px;color:#6b7280;">Invoice Date</td><td style="padding:3px 0;font-size:13px;font-weight:600;">${invoiceDate}</td></tr>
        <tr><td style="padding:3px 8px 3px 0;font-size:12px;color:#6b7280;">Due Date</td><td style="padding:3px 0;font-size:13px;font-weight:600;color:#ef4444;">${dueDate}</td></tr>
        ${jobReference ? `<tr><td style="padding:3px 8px 3px 0;font-size:12px;color:#6b7280;">Job Ref.</td><td style="padding:3px 0;font-size:13px;font-weight:600;">${jobReference}</td></tr>` : ""}
      </table>
    </div>
  </div>

  <!-- Line items table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
    <thead>
      <tr style="background:#07152b;color:white;">
        <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;width:60px;">Qty</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;width:100px;">Unit Price</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;width:100px;">Amount</th>
      </tr>
    </thead>
    <tbody style="background:white;">
      ${lineRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;margin-top:0;">
    <div style="min-width:240px;">
      <div style="border:1px solid #e5e7eb;border-top:none;">
        <div style="display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #e5e7eb;">
          <span style="font-size:13px;color:#6b7280;">Subtotal</span>
          <span style="font-size:13px;font-weight:600;">${formatCurrency(subtotal)}</span>
        </div>
        ${gstIncluded ? `<div style="display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #e5e7eb;">
          <span style="font-size:13px;color:#6b7280;">GST (10%)</span>
          <span style="font-size:13px;font-weight:600;">${formatCurrency(gstAmount)}</span>
        </div>` : ""}
        <div style="display:flex;justify-content:space-between;padding:12px 12px;background:#07152b;color:white;">
          <span style="font-size:15px;font-weight:700;">TOTAL DUE</span>
          <span style="font-size:18px;font-weight:900;color:#f97316;">${formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  </div>

  ${notes ? `
  <!-- Notes -->
  <div style="margin-top:24px;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
    <div style="font-size:11px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Notes</div>
    <div style="font-size:13px;line-height:1.6;white-space:pre-wrap;">${notes.replace(/</g, "&lt;")}</div>
  </div>` : ""}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:11px;color:#6b7280;">Thank you for your business. Please remit payment by ${dueDate}.</div>
    <div style="font-size:11px;color:#6b7280;">Generated by Elemetric · elemetric.com.au</div>
  </div>

</div>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const dest = `${FileSystem.cacheDirectory}elemetric-invoice-${invoiceNumber}.pdf`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(dest, {
          mimeType: "application/pdf",
          dialogTitle: `Share Invoice ${invoiceNumber}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Invoice Created", `Saved to: ${dest}`);
      }
    } catch (e: any) {
      Alert.alert("PDF Error", e?.message ?? "Could not generate invoice.");
    } finally {
      setPdfLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Invoice Generator</Text>
        <Text style={styles.subtitle}>Create professional ATO-compliant invoices</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Your Business ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Business</Text>
          <Text style={styles.fieldLabel}>Business / Trading Name</Text>
          <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="e.g. Smith Plumbing Pty Ltd" placeholderTextColor="rgba(255,255,255,0.3)" />
          <Text style={styles.fieldLabel}>ABN</Text>
          <TextInput style={styles.input} value={businessABN} onChangeText={setBusinessABN} placeholder="e.g. 12 345 678 901" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="numbers-and-punctuation" />
          <Text style={styles.fieldLabel}>Licence Number</Text>
          <TextInput style={styles.input} value={licenceNumber} onChangeText={setLicenceNumber} placeholder="e.g. PL012345" placeholderTextColor="rgba(255,255,255,0.3)" />
          <Text style={styles.fieldLabel}>Business Address</Text>
          <TextInput style={styles.input} value={businessAddress} onChangeText={setBusinessAddress} placeholder="Street, suburb, state, postcode" placeholderTextColor="rgba(255,255,255,0.3)" />
          <View style={styles.twoCol}>
            <View style={styles.halfCol}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput style={styles.input} value={businessPhone} onChangeText={setBusinessPhone} placeholder="0400 000 000" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="phone-pad" />
            </View>
            <View style={styles.halfCol}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput style={styles.input} value={businessEmail} onChangeText={setBusinessEmail} placeholder="you@email.com" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>
        </View>

        {/* ── Client ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client Details</Text>
          <Text style={styles.fieldLabel}>Client Name *</Text>
          <TextInput style={styles.input} value={clientName} onChangeText={setClientName} placeholder="Full name or company" placeholderTextColor="rgba(255,255,255,0.3)" />
          <Text style={styles.fieldLabel}>Client Address</Text>
          <TextInput style={styles.input} value={clientAddress} onChangeText={setClientAddress} placeholder="Property or billing address" placeholderTextColor="rgba(255,255,255,0.3)" />
          <Text style={styles.fieldLabel}>Client Email</Text>
          <TextInput style={styles.input} value={clientEmail} onChangeText={setClientEmail} placeholder="client@email.com" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="email-address" autoCapitalize="none" />
        </View>

        {/* ── Invoice Info ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <View style={styles.twoCol}>
            <View style={styles.halfCol}>
              <Text style={styles.fieldLabel}>Invoice Number</Text>
              <TextInput style={styles.input} value={invoiceNumber} onChangeText={setInvoiceNumber} placeholderTextColor="rgba(255,255,255,0.3)" />
            </View>
            <View style={styles.halfCol}>
              <Text style={styles.fieldLabel}>Job Reference</Text>
              <TextInput style={styles.input} value={jobReference} onChangeText={setJobReference} placeholder="Optional" placeholderTextColor="rgba(255,255,255,0.3)" />
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.halfCol}>
              <Text style={styles.fieldLabel}>Invoice Date</Text>
              <TextInput style={styles.input} value={invoiceDate} onChangeText={setInvoiceDate} placeholder="DD/MM/YYYY" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="numbers-and-punctuation" />
            </View>
            <View style={styles.halfCol}>
              <Text style={styles.fieldLabel}>Due Date</Text>
              <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="DD/MM/YYYY" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="numbers-and-punctuation" />
            </View>
          </View>

          <Pressable style={styles.gstToggle} onPress={() => setGstIncluded((v) => !v)}>
            <View style={[styles.gstCheck, gstIncluded && styles.gstCheckOn]}>
              {gstIncluded && <Text style={styles.gstCheckMark}>✓</Text>}
            </View>
            <Text style={styles.gstLabel}>Include GST (10%) in invoice totals</Text>
          </Pressable>
        </View>

        {/* ── Line Items ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          {lineItems.map((item, idx) => (
            <View key={item.id} style={styles.lineItem}>
              <View style={styles.lineItemRow}>
                <Text style={styles.lineNum}>#{idx + 1}</Text>
                {lineItems.length > 1 && (
                  <Pressable style={styles.removeLine} onPress={() => removeLine(item.id)}>
                    <Text style={styles.removeLineText}>×</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={styles.input}
                value={item.description}
                onChangeText={(v) => updateLine(item.id, "description", v)}
                placeholder="Labour, materials, service…"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              <View style={styles.twoCol}>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>Qty</Text>
                  <TextInput
                    style={styles.input}
                    value={item.qty}
                    onChangeText={(v) => updateLine(item.id, "qty", v)}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                </View>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>Unit Price (AUD)</Text>
                  <TextInput
                    style={styles.input}
                    value={item.unitPrice}
                    onChangeText={(v) => updateLine(item.id, "unitPrice", v)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                </View>
              </View>
              {item.description && item.unitPrice ? (
                <Text style={styles.lineTotal}>
                  Line total: {formatCurrency(parseNum(item.qty) * parseNum(item.unitPrice))}
                </Text>
              ) : null}
            </View>
          ))}
          <Pressable style={styles.addLineBtn} onPress={addLine}>
            <Text style={styles.addLineBtnText}>+ Add Line Item</Text>
          </Pressable>
        </View>

        {/* ── Totals preview ── */}
        <View style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
          </View>
          {gstIncluded && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST (10%)</Text>
              <Text style={styles.totalValue}>{formatCurrency(gstAmount)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.totalRowBig]}>
            <Text style={styles.totalLabelBig}>TOTAL DUE</Text>
            <Text style={styles.totalValueBig}>{formatCurrency(total)}</Text>
          </View>
        </View>

        {/* ── Notes ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Payment terms, bank details, thank you message…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
          />
        </View>

        {/* ── Generate ── */}
        <Pressable
          style={[styles.generateBtn, pdfLoading && { opacity: 0.6 }]}
          onPress={generatePdf}
          disabled={pdfLoading}
        >
          {pdfLoading
            ? <ActivityIndicator color="#0b1220" />
            : <Text style={styles.generateBtnText}>Generate & Share Invoice PDF</Text>
          }
        </Pressable>

        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 12 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 6, color: "white", fontSize: 28, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },

  body: { padding: 18, gap: 14, paddingBottom: 48 },

  section: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    gap: 8,
  },
  sectionTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  fieldLabel: { color: "rgba(255,255,255,0.65)", fontWeight: "700", fontSize: 12 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "white",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  twoCol: { flexDirection: "row", gap: 10 },
  halfCol: { flex: 1, gap: 4 },

  gstToggle: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  gstCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  gstCheckOn: { backgroundColor: "#f97316", borderColor: "#f97316" },
  gstCheckMark: { color: "white", fontWeight: "900", fontSize: 13 },
  gstLabel: { color: "rgba(255,255,255,0.7)", fontSize: 14 },

  lineItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 12,
    gap: 6,
  },
  lineItemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lineNum: { color: "rgba(255,255,255,0.40)", fontWeight: "700", fontSize: 12 },
  removeLine: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(239,68,68,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeLineText: { color: "#ef4444", fontWeight: "900", fontSize: 18, lineHeight: 20 },
  lineTotal: { color: "#22c55e", fontWeight: "700", fontSize: 13 },
  addLineBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.30)",
    backgroundColor: "rgba(249,115,22,0.08)",
    marginTop: 4,
  },
  addLineBtnText: { color: "#f97316", fontWeight: "700", fontSize: 14 },

  totalsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  totalLabel: { color: "rgba(255,255,255,0.55)", fontSize: 14 },
  totalValue: { color: "white", fontWeight: "700", fontSize: 14 },
  totalRowBig: { backgroundColor: "rgba(249,115,22,0.10)", borderBottomWidth: 0 },
  totalLabelBig: { color: "#f97316", fontWeight: "900", fontSize: 16 },
  totalValueBig: { color: "#f97316", fontWeight: "900", fontSize: 20 },

  generateBtn: {
    backgroundColor: "#f97316",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  generateBtnText: { color: "#0b1220", fontWeight: "900", fontSize: 17 },

  back: { alignItems: "center" },
  backText: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },
});
