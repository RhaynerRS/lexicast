using System;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Platform.Storage;
using Avalonia.Threading;
using LexicastUi.Models;

namespace LexicastUi.Views;

public partial class ProgressView : UserControl
{
    private readonly INavigationHost _host;
    private readonly DispatcherTimer _pollTimer;
    private readonly string _jobId;
    private readonly string _sourceFileName;
    private bool _isPolling;
    private bool _cancelRequested;

    public ProgressView(INavigationHost host, string jobId, string sourceFileName)
    {
        _host = host;
        _jobId = jobId;
        _sourceFileName = sourceFileName;

        InitializeComponent();
        FileNameText.Text = _sourceFileName;

        _pollTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1.5) };
        _pollTimer.Tick += PollTimer_Tick;
        _pollTimer.Start();
    }

    protected override void OnDetachedFromVisualTree(VisualTreeAttachmentEventArgs e)
    {
        base.OnDetachedFromVisualTree(e);
        _pollTimer.Stop();
    }

    private async void PollTimer_Tick(object? sender, EventArgs e)
    {
        if (_isPolling)
        {
            return;
        }

        _isPolling = true;
        try
        {
            TranslationJob job = await App.ApiClient.GetJobAsync(_jobId);
            ApplyJobState(job);

            if (job.IsCompleted || job.IsFailed || job.IsCancelled)
            {
                _pollTimer.Stop();
            }
        }
        catch (Exception ex)
        {
            _pollTimer.Stop();
            ShowError(ex.Message);
        }
        finally
        {
            _isPolling = false;
        }
    }

    private void ApplyJobState(TranslationJob job)
    {
        double percent = Math.Clamp(job.Progress * 100.0, 0, 100);
        JobProgressBar.Value = percent;
        ProgressPercentText.Text = $"{percent:0}%";
        StatusText.Text = $"Status: {job.Status}";

        if (!string.IsNullOrEmpty(job.Warning))
        {
            WarningText.Text = job.Warning;
            WarningBanner.IsVisible = true;
        }

        if (job.IsFailed && !string.IsNullOrEmpty(job.Error))
        {
            ShowError(job.Error);
        }

        DownloadButton.IsEnabled = job.IsCompleted;

        CancelButton.IsVisible = job.IsCancellable || job.IsCancelling;
        CancelButton.IsEnabled = job.IsCancellable && !_cancelRequested;
        CancelButton.Content = job.IsCancelling ? "Cancelando..." : "Cancelar tradução";
    }

    private async void DownloadButton_Click(object? sender, RoutedEventArgs e)
    {
        var topLevel = TopLevel.GetTopLevel(this);
        if (topLevel is null)
        {
            return;
        }

        var file = await topLevel.StorageProvider.SaveFilePickerAsync(new FilePickerSaveOptions
        {
            Title = "Salvar tradução",
            SuggestedFileName = $"translated_{_sourceFileName}",
            FileTypeChoices = new[] { new FilePickerFileType("EPUB") { Patterns = new[] { "*.epub" } } }
        });

        if (file is null)
        {
            return;
        }

        DownloadButton.IsEnabled = false;
        DownloadProgressBar.IsVisible = true;
        try
        {
            await App.ApiClient.DownloadAsync(_jobId, file.Path.LocalPath);
        }
        catch (Exception ex)
        {
            ShowError(ex.Message);
        }
        finally
        {
            DownloadButton.IsEnabled = true;
            DownloadProgressBar.IsVisible = false;
        }
    }

    private async void CancelButton_Click(object? sender, RoutedEventArgs e)
    {
        if (_cancelRequested)
        {
            return;
        }

        _cancelRequested = true;
        CancelButton.IsEnabled = false;
        CancelButton.Content = "Cancelando...";
        try
        {
            TranslationJob job = await App.ApiClient.CancelJobAsync(_jobId);
            ApplyJobState(job);
        }
        catch (Exception ex)
        {
            _cancelRequested = false;
            ShowError(ex.Message);
        }
    }

    private void NewTranslationButton_Click(object? sender, RoutedEventArgs e)
    {
        _host.ShowUpload();
    }

    private void ShowError(string message)
    {
        ErrorText.Text = message;
        ErrorBanner.IsVisible = true;
    }
}
