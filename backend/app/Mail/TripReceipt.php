<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TripReceipt extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public array $receipt, public string $link)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: sprintf('Your Jali receipt %s — %s RWF', $this->receipt['number'], number_format($this->receipt['total'])));
    }

    public function content(): Content
    {
        return new Content(view: 'receipt', with: ['r' => $this->receipt, 'link' => $this->link, 'email' => true]);
    }
}
