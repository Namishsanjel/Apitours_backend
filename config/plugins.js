const allowedMediaTypes = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'text/plain',
  'text/csv',
];

const deniedTypes = [
  'image/svg+xml',
  'application/vnd.microsoft.portable-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-sh',
  'text/x-shellscript',
  'application/x-mach-binary',
];

module.exports = () => {
  // SMTP settings are read from the environment only. Never hard-code
  // credentials here. See .env.example for the full list of variables.
  const smtpPort = Number.parseInt(process.env.SMTP_PORT, 10);
  const hasValidPort = !Number.isNaN(smtpPort);
  const hasCredentials = Boolean(process.env.SMTP_USERNAME && process.env.SMTP_PASSWORD);

  return {
    'users-permissions': {
      config: {
        jwtManagement: 'refresh',
        sessions: {
          httpOnly: true,
        },
      },
    },
    upload: {
      config: {
        security: {
          allowedTypes: allowedMediaTypes,
          deniedTypes,
        },
      },
    },
    email: {
      config: {
        provider: 'nodemailer',
        providerOptions: {
          host: process.env.SMTP_HOST,
          port: hasValidPort ? smtpPort : undefined,
          // Implicit TLS only on the standard submission-over-TLS port.
          secure: hasValidPort && smtpPort === 465,
          ...(hasCredentials
            ? {
                auth: {
                  user: process.env.SMTP_USERNAME,
                  pass: process.env.SMTP_PASSWORD,
                },
              }
            : {}),
        },
        settings: {
          defaultFrom: process.env.EMAIL_FROM,
          defaultReplyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM,
        },
      },
    },
  };
};
