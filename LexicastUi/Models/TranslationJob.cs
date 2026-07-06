using System.Text.Json.Serialization;

namespace LexicastUi.Models;

public sealed class TranslationJob
{
    [JsonPropertyName("job_id")]
    public string JobId { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("progress")]
    public double Progress { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }

    [JsonPropertyName("warning")]
    public string? Warning { get; set; }

    public bool IsCompleted => Status == "completed";

    public bool IsFailed => Status == "failed";

    public bool IsCancelling => Status == "cancelling";

    public bool IsCancelled => Status == "cancelled";

    public bool IsCancellable => Status is "queued" or "running";
}
