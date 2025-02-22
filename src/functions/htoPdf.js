const { app } = require("@azure/functions");
const puppeteer = require("puppeteer");

app.http("htoPdf", {
  methods: ["POST"], // Removed GET since we need to send HTML in body
  authLevel: "anonymous",
  handler: async (request, context) => {
    context.log(`Http function processing request for url "${request.url}"`);

    try {
      // Ensure request body is properly parsed
      const body = await request.json();
      const { html, pdfConfig } = body;

      if (!html) {
        return {
          status: 400,
          body: { message: "Please provide HTML content in the request body." },
          headers: {
            "Content-Type": "application/json",
          },
        };
      }

      context.log("Launching browser");

      // Launch browser with proper error handling
      let browser;
      try {
        browser = await puppeteer.launch({
          executablePath: '/usr/bin/chromium-browser',
          headless: true, // Using new headless mode
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote",
          ],
        });
      } catch (browserError) {
        context.log.error("Browser launch failed:", browserError);
        throw new Error("Failed to initialize PDF generator");
      }

      // Create new page with proper error handling
      const page = await browser.newPage();

      // Set content with timeout
      await page.setContent(html, {
        waitUntil: "networkidle0",
        timeout: 30000, // 30 second timeout
      });

      // Add styles with proper page margins
      await page.addStyleTag({
        content: `
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 20px;
                        max-width: 100%;
                    }
                    .pagebreak {
                        page-break-after: always;
                    }
                `,
      });

      // Generate PDF with timeout
      const pdfBuffer = await page.pdf(pdfConfig);

      // Ensure browser cleanup
      await browser.close();
      context.log("PDF generation completed successfully");

      return {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": pdfBuffer.length,
          "Content-Disposition": 'attachment; filename="generated.pdf"',
        },
        body: pdfBuffer,
      };
    } catch (error) {
      context.log.error("Error in PDF generation:", error);

      return {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          message: "Error generating PDF",
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      };
    }
  },
});
