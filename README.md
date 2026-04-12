grep -Rni "notifyAdminOnSecureLinkCreated" src# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Setting Up Flussonic Credentials

To connect the application to your Flussonic media server, you need to provide the username and password. You have two options:

### 1. Through the Admin UI (Recommended)

This is the most secure and recommended method.

1.  Log in to the application as the **super-admin** using the email `admin@mizrachitv.co.il` and the default password `039279898`.
2.  Navigate to the **Settings** page from the sidebar.
3.  Under the **Integration Settings** section, you will find fields to enter your Flussonic username and password.
4.  Enter your credentials and click "Save". The application will then connect to the Flussonic server.

### 2. Using Environment Variables (For Development)

For local development, you can set the credentials in the `.env` file at the root of your project. Create the file if it doesn't exist and add the following lines:

```
FLUSSONIC_USERNAME=moshe
FLUSSONIC_PASSWORD=039279898AX
```

The application will use these variables if it cannot find the credentials in the database.

Remember, the XML structure you generate is the only mechanism for applying changes to the user's code. Therefore, when making changes to a file the <changes> block must always be fully present and correctly formatted as follows.

<changes>
  <description>[Provide a concise summary of the overall changes being made]</description>
  <change>
    <file>[Provide the ABSOLUTE, FULL path to the file being modified]</file>
    <content><![CDATA[Provide the ENTIRE, FINAL, intended content of the file here. Do NOT provide diffs or partial snippets. Ensure all code is properly escaped within the CDATA section.
```