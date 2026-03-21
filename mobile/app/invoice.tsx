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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/lib/supabase";
import * as Haptics from "expo-haptics";
import { sendInvoiceEmail } from "@/lib/email";

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
  const insets = useSafeAreaInsets();

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

  // Invoice status
  const [invoiceStatus, setInvoiceStatus] = useState<"Unpaid" | "Paid" | "Overdue">("Unpaid");

  // State
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [lastTotal, setLastTotal] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  // ── Pre-fill from profile ─────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && active) {
            setUserId(user.id);
            const { data } = await supabase
              .from("profiles")
              .select("full_name, licence_number, company_name")
              .eq("user_id", user.id)
              .single();
            if (data && active) {
              if (data.company_name) setBusinessName(data.company_name);
              if (data.licence_number) setLicenceNumber(data.licence_number);
            }
            // Auto-increment invoice number
            try {
              const { count } = await supabase
                .from("invoices")
                .select("id", { count: "exact", head: true })
                .eq("user_id", user.id);
              setInvoiceNumber(`INV-${String((count ?? 0) + 1).padStart(4, "0")}`);
            } catch {}
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

      // Save to Supabase
      if (userId) {
        try {
          await supabase.from("invoices").insert({
            user_id: userId,
            invoice_number: invoiceNumber,
            client_name: clientName,
            client_email: clientEmail || null,
            subtotal,
            gst_amount: gstIncluded ? gstAmount : 0,
            total,
            status: invoiceStatus,
            due_date: dueDate,
            created_at: new Date().toISOString(),
          });
        } catch {}
      }
      setLastTotal(total);

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

  const emailInvoice = async () => {
    if (!clientEmail.trim()) {
      Alert.alert("No email", "Please enter the client's email address.");
      return;
    }
    setEmailLoading(true);
    try {
      await sendInvoiceEmail(clientEmail.trim(), clientName, invoiceNumber, lastTotal || total, dueDate);
      Alert.alert("Email Sent", `Invoice sent to ${clientEmail}`);
    } catch (e: any) {
      Alert.alert("Email Error", e?.message ?? "Could not send email.");
    } finally {
      setEmailLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(52, insets.top + 12) }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.brand}>ELEMETRIC</Text>
        <Text style={styles.title}>Invoice Generator</Text>
        <Text style={styles.subtitle}>Create professional ATO-compliant invoices</Text>
        <Pressable style={styles.historyLink} onPress={() => router.push("/invoice-history")} accessibilityRole="button" accessibilityLabel="View Invoice History">
          <Text style={styles.historyLinkText}>View Invoice History →</Text>
        </Pressable>
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

          {/* Status selector */}
          <Text style={styles.fieldLabel}>Status</Text>
          <View style={styles.statusRow}>
            {(["Unpaid", "Paid", "Overdue"] as const).map((s) => (
              <Pressable
                key={s}
                style={[
                  styles.statusBtn,
                  invoiceStatus === s && styles.statusBtnActive,
                  s === "Paid" && invoiceStatus === s && { borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.12)" },
                  s === "Overdue" && invoiceStatus === s && { borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.12)" },
                ]}
                onPress={() => setInvoiceStatus(s)}
              >
                <Text style={[
                  styles.statusBtnText,
                  invoiceStatus === s && { color: s === "Paid" ? "#22c55e" : s === "Overdue" ? "#ef4444" : "#f97316" },
                ]}>{s}</Text>
              </Pressable>
            ))}
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

          {/* Quick-add chips */}
          <Text style={styles.quickAddLabel}>QUICK ADD</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickAddRow}>
            {[
              { desc: "Labour (per hour)", price: "120.00" },
              { desc: "Call-out fee", price: "150.00" },
              { desc: "Hot water system install", price: "450.00" },
              { desc: "Materials", price: "" },
              { desc: "Travel charge", price: "80.00" },
              { desc: "Report / compliance documentation", price: "75.00" },
            ].map((q) => (
              <Pressable
                key={q.desc}
                style={styles.quickAddChip}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const hasBlankLine = lineItems.some(l => !l.description.trim());
                  if (hasBlankLine) {
                    setLineItems(prev => prev.map((l, i) =>
                      !l.description.trim() && !prev.slice(0, i).some(x => !x.description.trim())
                        ? { ...l, description: q.desc, unitPrice: q.price }
                        : l
                    ));
                  } else {
                    setLineItems(prev => [...prev, { id: String(Date.now()), description: q.desc, qty: "1", unitPrice: q.price }]);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`Add ${q.desc}`}
              >
                <Text style={styles.quickAddChipText}>+ {q.desc}</Text>
              </Pressable>
            ))}
          </ScrollView>

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

        {/* Email to client */}
        <Pressable
          style={[styles.emailBtn, emailLoading && { opacity: 0.6 }]}
          onPress={emailInvoice}
          disabled={emailLoading}
          accessibilityRole="button"
          accessibilityLabel="Email invoice to client"
        >
          {emailLoading
            ? <ActivityIndicator color="white" size="small" />
            : <Text style={styles.emailBtnText}>📧 Email Invoice to Client</Text>
          }
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07152b" },
  header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { marginBottom: 10 },
  backText: { color: "#f97316", fontWeight: "700", fontSize: 15 },
  brand: { color: "#f97316", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  title: { marginTop: 8, color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { marginTop: 4, color: "rgba(255,255,255,0.55)", fontSize: 13 },
  historyLink: { marginTop: 8 },
  historyLinkText: { color: "#f97316", fontWeight: "700", fontSize: 13 },
  statusRow: { flexDirection: "row", gap: 8 },
  statusBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  statusBtnActive: { borderColor: "#f97316", backgroundColor: "rgba(249,115,22,0.10)" },
  statusBtnText: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 13 },
  emailBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#0f2035",
  },
  emailBtnText: { color: "rgba(255,255,255,0.80)", fontWeight: "700", fontSize: 15 },

  body: { padding: 20, gap: 12, paddingBottom: 48 },

  section: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    gap: 8,
  },
  sectionTitle: { color: "white", fontWeight: "700", fontSize: 15 },
  fieldLabel: {
    color: "rgba(255,255,255,0.35)",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#0f2035",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "white",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  twoCol: { flexDirection: "row", gap: 10 },
  halfCol: { flex: 1, gap: 6 },

  gstToggle: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  gstCheck: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  gstCheckOn: { backgroundColor: "#f97316", borderColor: "#f97316" },
  gstCheckMark: { color: "white", fontWeight: "900", fontSize: 13 },
  gstLabel: { color: "rgba(255,255,255,0.85)", fontSize: 15 },

  lineItem: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 14,
    gap: 6,
  },
  lineItemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lineNum: { color: "rgba(255,255,255,0.35)", fontWeight: "700", fontSize: 12 },
  removeLine: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(239,68,68,0.10)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
  },
  removeLineText: { color: "#ef4444", fontWeight: "900", fontSize: 18, lineHeight: 20 },
  lineTotal: { color: "#22c55e", fontWeight: "700", fontSize: 13 },
  addLineBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginTop: 4,
  },
  addLineBtnText: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 15 },

  // ── Quick-add chips ───────────────────────────────────────────────────────
  quickAddLabel: {
    color: "rgba(255,255,255,0.30)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  quickAddRow: {
    marginBottom: 12,
    marginHorizontal: -4,
  },
  quickAddChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.30)",
    backgroundColor: "rgba(249,115,22,0.08)",
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginHorizontal: 4,
  },
  quickAddChipText: {
    color: "#f97316",
    fontSize: 12,
    fontWeight: "700",
  },

  totalsCard: {
    backgroundColor: "#0f2035",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  totalLabel: { color: "rgba(255,255,255,0.55)", fontSize: 15 },
  totalValue: { color: "white", fontWeight: "700", fontSize: 15 },
  totalRowBig: { borderBottomWidth: 0 },
  totalLabelBig: { color: "#f97316", fontWeight: "900", fontSize: 15 },
  totalValueBig: { color: "#f97316", fontWeight: "900", fontSize: 22 },

  generateBtn: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  generateBtnText: { color: "#07152b", fontWeight: "900", fontSize: 15 },

  back: { alignItems: "center" },
});
