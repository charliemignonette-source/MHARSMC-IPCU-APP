import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

let resendClient: Resend | null = null;

function getResend() {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    resendClient = new Resend(key);
  }
  return resendClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for sending drug approval emails
  app.post("/api/notify-pharmacy", async (req, res) => {
    const { requestId, drugName, patientName, unit, pharmacyEmail } = req.body;

    if (!process.env.RESEND_API_KEY) {
       console.warn("RESEND_API_KEY not set. Email notification skipped.");
       return res.status(200).json({ success: true, message: "API key missing, simulating success" });
    }

    try {
      const emailTo = pharmacyEmail || process.env.VITE_PHARMACY_EMAIL;
      
      if (!emailTo) {
        return res.status(400).json({ error: "No pharmacy email configured" });
      }

      const resend = getResend();
      const { data, error } = await resend.emails.send({
        from: 'AMS System <notifications@resend.dev>',
        to: [emailTo],
        subject: `[APPROVED] Drug Request for ${patientName}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2 style="color: #059669;">Drug Request Approved</h2>
            <p>A drug request has been approved and requires dispensing.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <table style="width: 100%;">
              <tr><td style="font-weight: bold; width: 150px;">Drug:</td><td>${drugName}</td></tr>
              <tr><td style="font-weight: bold;">Patient:</td><td>${patientName}</td></tr>
              <tr><td style="font-weight: bold;">Unit:</td><td>${unit}</td></tr>
              <tr><td style="font-weight: bold;">Request ID:</td><td>${requestId}</td></tr>
            </table>
            <p style="margin-top: 20px;">Please process this request immediately.</p>
          </div>
        `
      });

      if (error) {
        console.error("Resend Error:", error);
        return res.status(500).json({ error: error.message });
      }

      res.json({ success: true, data });
    } catch (err: any) {
      console.error("Server Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
