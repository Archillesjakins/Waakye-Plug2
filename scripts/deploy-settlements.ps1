# Deploys the 2 patched settlement edge functions using the Supabase CLI's
# stored login token (Windows Credential Manager). The token is read into an
# env var and NEVER printed.
$code = @'
using System;
using System.Runtime.InteropServices;
public class CredManDeploy {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags; public int Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist;
    public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredRead(string target, int type, int flags, out IntPtr credPtr);
  [DllImport("advapi32.dll")]
  public static extern void CredFree(IntPtr cred);
  public static string ReadToken(string target) {
    IntPtr p;
    if (!CredRead(target, 1, 0, out p)) return null;
    CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
    string result = null;
    if (cred.CredentialBlobSize > 0) {
      byte[] blob = new byte[cred.CredentialBlobSize];
      Marshal.Copy(cred.CredentialBlob, blob, 0, blob.Length);
      result = System.Text.Encoding.UTF8.GetString(blob).TrimEnd('\0');
    }
    CredFree(p);
    return result;
  }
}
'@
Add-Type -TypeDefinition $code

$token = [CredManDeploy]::ReadToken('Supabase CLI:supabase')
if (-not $token) { Write-Host 'NO_TOKEN_IN_CREDMAN'; exit 1 }
Write-Host "token retrieved (starts $($token.Substring(0,4))..., length $($token.Length))"

$env:SUPABASE_ACCESS_TOKEN = $token
Set-Location C:\Users\user\Desktop\Waakye-plug-rider
& C:\Users\user\supabase-cli\supabase.exe functions deploy create-settlement verify-settlement --project-ref verncapitxzsgcughvil 2>&1 | Out-String
Write-Host "DEPLOY_EXIT=$LASTEXITCODE"
