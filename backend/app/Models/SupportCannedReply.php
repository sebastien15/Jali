<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupportCannedReply extends Model
{
    protected $fillable = ['title', 'body', 'created_by'];
}
